import { SearchMode } from "agent-twitter-client";
import { composeContext, elizaLogger } from "@elizaos/core";
import { generateMessageResponse, generateText } from "@elizaos/core";
import { messageCompletionFooter } from "@elizaos/core";
import {
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type IImageDescriptionService,
    ModelClass,
    ServiceType,
    type State,
} from "@elizaos/core";
import { stringToUuid } from "@elizaos/core";
import type { ClientBase } from "./base";
import { buildConversationThread, sendTweet, wait } from "./utils.ts";
import { scrapeProjectUpdates } from "./rootdata/scrap_net.ts";
import { scrapeFundraisingProjects } from "./rootdata/scrap_project.ts";

const twitterSearchTemplate =
    `{{timeline}}

{{providers}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{postDirections}}

{{recentPosts}}

# Task: Respond to the following post in the style and perspective of {{agentName}} (aka @{{twitterUserName}}). Write a {{adjective}} response for {{agentName}} to say directly in response to the post. don't generalize.
{{currentPost}}

IMPORTANT: Your response CANNOT be longer than 20 words.
Aim for 1-2 short sentences maximum. Be concise and direct.

Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.

` + messageCompletionFooter;

export class TwitterSearchClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    twitterUsername: string;
    searchIndex: number;
    private respondedTweets: Set<string> = new Set();

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
        this.twitterUsername = this.client.twitterConfig.TWITTER_USERNAME;
        this.searchIndex = 0;
    }

    async start() {
        await this.refreshSearchTopics();
        this.refreshSearchTopicsLoop();
        this.engageWithSearchTermsLoop();
    }

    // new implementation
    private async refreshSearchTopics() {
    try {
        const topics1 = await scrapeProjectUpdates();
        const topics2 = await scrapeFundraisingProjects();
        this.runtime.character.topics = Array.from(new Set([
        ...this.runtime.character.topics,
        ...topics1,
        ...topics2
        ]));
        elizaLogger.log("Search topics initialized");
    } catch (error) {
        elizaLogger.error("Error initializing topics:", error);
    }
    }

    private refreshSearchTopicsLoop() {
    setInterval(() => {
        this.refreshSearchTopics();
    }, 1000 * 60 * 60 * 24); // 每24小时
    }

    private engageWithSearchTermsLoop() {
        this.engageWithSearchTerms().then();
        const randomMinutes = Math.floor(Math.random() * (5)) + 5; // modify 5 minutes to 10 minutes
        elizaLogger.log(
            `Next twitter search scheduled in ${randomMinutes} minutes`
        );
        setTimeout(
            () => this.engageWithSearchTermsLoop(),
            randomMinutes * 60 * 1000
        );
    }
    
    private async engageWithSearchTerms() {
        elizaLogger.log("Engaging with search terms");
        try {
            const searchTerm = [...this.runtime.character.topics][
                this.searchIndex
            ];

            elizaLogger.log("Fetching search tweets:", searchTerm);
            // TODO: we wait 5 seconds here to avoid getting rate limited on startup, but we should queue
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const recentTweets = await this.client.fetchSearchTweets(
                searchTerm,
                50,
                SearchMode.Latest
            );
            elizaLogger.log("Search tweets fetched");

            // return all tweets (modify)
            const slicedTweets = recentTweets.tweets

            if (slicedTweets.length === 0) {
                elizaLogger.log(
                    "No valid tweets found for the search term",
                    searchTerm
                );
                return;
            }

/*            const prompt = `
  Here are some tweets related to the search term "${searchTerm}":

  ${[...slicedTweets, ...homeTimeline]
      .filter((tweet) => {
          // ignore tweets where any of the thread tweets contain a tweet by the bot
          const thread = tweet.thread;
          const botTweet = thread.find(
              (t) => t.username === this.twitterUsername
          );
          return !botTweet;
      })
      .map(
          (tweet) => `
    ID: ${tweet.id}${tweet.inReplyToStatusId ? ` In reply to: ${tweet.inReplyToStatusId}` : ""}
    From: ${tweet.name} (@${tweet.username})
    Text: ${tweet.text}
  `
      )
      .join("\n")}
      
  Which tweet is the most interesting and relevant for Ruby to reply to? Please provide only the ID of the tweet in your response.
  Notes:
    - Respond to Chinese tweets only
    - Respond to tweets that don't have a lot of hashtags, links, URLs or images
    - Respond to tweets that are not retweets
    - Respond to tweets where there is an easy exchange of ideas to have with the user
    - ONLY respond with the ID of the tweet`;
*/
            const prompt = `
                Here are some tweets:
                ${slicedTweets
                    .filter((tweet) => {
                        // ignore tweets where any of the thread tweets contain a tweet by the bot
                        const thread = tweet.thread;
                        const botTweet = thread.find(
                            (t) => t.username === this.twitterUsername
                        );
                        return !botTweet;
                    }).map((tweet, i) => `Tweet ${i + 1}: ${tweet.text}`).join("\n")}

                Which one is the most relevant to these topics: ${this.runtime.character.topics.join(", ")}?

                Please return the index (1-based).
            `;

            const mostInterestingTweetResponse = await generateText({
                runtime: this.runtime,
                context: prompt,
                modelClass: ModelClass.SMALL,
            });

            /*--------- modify -----------*/
            const tweetId = parseInt(mostInterestingTweetResponse.trim()) - 1;
            const selectedTweet = slicedTweets[tweetId]; 
            /*----------------------------*/

            if (!selectedTweet) {
                elizaLogger.warn("No matching tweet found for the selected ID");
                elizaLogger.log("Selected tweet ID:", tweetId);
                return;
            }

            elizaLogger.log("Selected tweet to reply to:", selectedTweet?.text);

            if (selectedTweet.username === this.twitterUsername) {
                elizaLogger.log("Skipping tweet from bot itself");
                return;
            }

            const conversationId = selectedTweet.conversationId;
            const roomId = stringToUuid(
                conversationId + "-" + this.runtime.agentId
            );

            const userIdUUID = stringToUuid(selectedTweet.userId as string);

            await this.runtime.ensureConnection(
                userIdUUID,
                roomId,
                selectedTweet.username,
                selectedTweet.name,
                "twitter"
            );

            // crawl additional conversation tweets, if there are any
            await buildConversationThread(selectedTweet, this.client);

            const message = {
                id: stringToUuid(selectedTweet.id + "-" + this.runtime.agentId),
                agentId: this.runtime.agentId,
                content: {
                    text: selectedTweet.text,
                    url: selectedTweet.permanentUrl,
                    inReplyTo: selectedTweet.quotedStatusId
                        ? stringToUuid(
                              selectedTweet.quotedStatusId +
                                  "-" +
                                  this.runtime.agentId
                          )
                        : undefined,
                },
                userId: userIdUUID,
                roomId,
                // Timestamps are in seconds, but we need them in milliseconds
                createdAt: selectedTweet.timestamp * 1000,
            };

            if (!message.content.text) {
                elizaLogger.warn("Returning: No response text found");
                return;
            }

            // Fetch replies and retweets
            const replies = selectedTweet.thread;
            const replyContext = replies
                .filter((reply) => reply.username !== this.twitterUsername)
                .map((reply) => `@${reply.username}: ${reply.text}`)
                .join("\n");

            let tweetBackground = "";
            if (selectedTweet.isRetweet) {
                const originalTweet = await this.client.requestQueue.add(() =>
                    this.client.twitterClient.getTweet(selectedTweet.id)
                );
                tweetBackground = `Retweeting @${originalTweet.username}: ${originalTweet.text}`;
            }

            // Generate image descriptions using GPT-4 vision API
            const imageDescriptions = [];
            for (const photo of selectedTweet.photos) {
                elizaLogger.log("Processing image:", photo.url);
                const description = this.runtime
                    .getService<IImageDescriptionService>(
                        ServiceType.IMAGE_DESCRIPTION
                    )
                const description1 = await description.describeImage(photo.url);
                imageDescriptions.push(description1);
            }

            let state = await this.runtime.composeState(message, {
                twitterClient: this.client.twitterClient,
                twitterUserName: this.twitterUsername,
                tweetContext: `${tweetBackground}

  Original Post:
  By @${selectedTweet.username}
  ${selectedTweet.text}${replyContext.length > 0 && `\nReplies to original post:\n${replyContext}`}
  ${`Original post text: ${selectedTweet.text}`}
  ${selectedTweet.urls.length > 0 ? `URLs: ${selectedTweet.urls.join(", ")}\n` : ""}${imageDescriptions.length > 0 ? `\nImages in Post (Described): ${imageDescriptions.join(", ")}\n` : ""}
  `,
            });

            await this.client.saveRequestMessage(message, state as State);

            const context = composeContext({
                state,
                template:
                    this.runtime.character.templates?.twitterSearchTemplate ||
                    twitterSearchTemplate,
            });

            const responseContent = await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,  // modify to small model
            });

            responseContent.inReplyTo = message.id;

            const response = responseContent;

            if (!response.text) {
                elizaLogger.warn("Returning: No response text found");
                return;
            }

            elizaLogger.log(
                `Bot would respond to tweet ${selectedTweet.id} with: ${response.text}`
            );

            this.searchIndex = (this.searchIndex + 1) % this.runtime.character.topics.length;
            elizaLogger.log(`SelectedTweet ID: ${selectedTweet.id}`);
            try {
                const callback: HandlerCallback = async (response: Content) => {
                    const memories = await sendTweet(
                        this.client,
                        response,
                        message.roomId,
                        this.twitterUsername,
                        selectedTweet.id
                    );
                    return memories;
                };

                const responseMessages = await callback(responseContent);

                state = await this.runtime.updateRecentMessageState(state);

                for (const responseMessage of responseMessages) {
                    await this.runtime.messageManager.createMemory(
                        responseMessage,
                        false
                    );
                }

                state = await this.runtime.updateRecentMessageState(state);

                await this.runtime.evaluate(message, state);

                await this.runtime.processActions(
                    message,
                    responseMessages,
                    state,
                    callback
                );

                this.respondedTweets.add(selectedTweet.id);
                const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${selectedTweet.id} - ${selectedTweet.username}: ${selectedTweet.text}\nAgent's Output:\n${response.text}`;

                await this.runtime.cacheManager.set(
                    `twitter/tweet_generation_${selectedTweet.id}.txt`,
                    responseInfo
                );

                await wait();
            } catch (error) {
                console.error(`Error sending response post: ${error}`);
            }
        } catch (error) {
            console.error("Error engaging with search terms:", error);
        }
    }
}
