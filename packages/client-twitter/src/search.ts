import { SearchMode } from "agent-twitter-client";
import { composeContext, elizaLogger, getEmbeddingZeroVector, Memory } from "@elizaos/core";
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
import { scrapeSuiTwitterUsernames } from "./rootdata/scrap_project_detail.ts"


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

# make a summary of the post
Create a concise tweet (max 180 characters) to share this important update:
Original tweet: {{currentPost}}
                        
Requirements:
- Must be in English
- Focus on key information
- Keep it under 180 characters
- No emojis
- No questions
- Include important details about Web3, airdrops, IDO, or ICO if present

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
            const topics1 = await scrapeSuiTwitterUsernames();
            const topics2 = await scrapeProjectUpdates();
            this.runtime.character.topics = Array.from(new Set([
            ...this.runtime.character.topics,
            ...topics1,
            ...topics2
            ]));
            elizaLogger.log("Search topics initialized");
            
            // Add project tweets forwarding
            //await this.forwardProjectTweets(topics1);
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
        const randomMinutes = Math.floor(Math.random() * (5)) + 10; // modify 10 minutes to 15 minutes
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
            let searchUsername = [...this.runtime.character.topics][
                this.searchIndex
            ];

            if (!searchUsername) {
                elizaLogger.warn("No valid username found in topics");
                this.searchIndex = (this.searchIndex + 1) % this.runtime.character.topics.length;
                return;
            }

            // TODO: we wait 5 seconds here to avoid getting rate limited on startup, but we should queue
            await new Promise((resolve) => setTimeout(resolve, 5000));

            let tweets = await this.client.fetchUserTweets(searchUsername, 3);
            let l = 0
            while (tweets.tweets.length == 0 && l < this.runtime.character.topics.length){
                elizaLogger.log(
                    `No recent tweets (within 2 days) found for user @${searchUsername}`
                );
                this.searchIndex = (this.searchIndex + 1) % this.runtime.character.topics.length;
                searchUsername = [...this.runtime.character.topics][this.searchIndex]
                tweets = await this.client.fetchUserTweets(searchUsername, 3);
                l += 1;
            }
            
            if (tweets.tweets.length === 0) {
                elizaLogger.log(
                    `No recent tweets (within 2 days) found for user @${searchUsername}`
                );
                this.searchIndex = (this.searchIndex + 1) % this.runtime.character.topics.length;
                return;
            }
            elizaLogger.log(`Found ${tweets.tweets.length} recent tweets from @${searchUsername}`);

            for (const tweet of tweets.tweets) {
                // Skip if we've already responded to this tweet
                if (this.respondedTweets.has(tweet.id)) {
                    continue;
                }
                if (tweet.username === this.twitterUsername) {
                    elizaLogger.log("Skipping tweet from bot itself");
                    break;
                }
                
                // filter out tweets that are not relevant to Web3, airdrops, IDO, ICO, or important project updates
                const relevancePrompt = `
                    Analyze this tweet and determine if it's relevant to Web3, airdrops, IDO, ICO, or important project updates.
                    Tweet content: ${tweet.text}
                    
                    Return only "RELEVANT" or "NOT_RELEVANT".
                `;

                const relevanceResponse = await generateText({
                    runtime: this.runtime,
                    context: relevancePrompt,
                    modelClass: ModelClass.SMALL,
                });

                elizaLogger.log("gpt result: ",relevanceResponse.trim())

                // Pass
                if (relevanceResponse.trim() === "RELEVANT") {
                    const conversationId = tweet.conversationId;
                    const roomId = stringToUuid(
                        conversationId + "-" + this.runtime.agentId
                    );
        
                    const userIdUUID = stringToUuid(tweet.userId as string);
        
                    await this.runtime.ensureConnection(
                        userIdUUID,
                        roomId,
                        tweet.username,
                        tweet.name,
                        "twitter"
                    );
        
                    // crawl additional conversation tweets, if there are any
                    await buildConversationThread(tweet, this.client);
        
                    const message = {
                        id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
                        agentId: this.runtime.agentId,
                        content: {
                            text: tweet.text,
                            url: tweet.permanentUrl,
                            inReplyTo: tweet.quotedStatusId
                                ? stringToUuid(
                                    tweet.quotedStatusId +
                                        "-" +
                                        this.runtime.agentId
                                )
                                : undefined,
                        },
                        userId: userIdUUID,
                        roomId,
                        // Timestamps are in seconds, but we need them in milliseconds
                        createdAt: tweet.timestamp * 1000,
                    };
        
                    if (!message.content.text) {
                        elizaLogger.warn("Returning: No response text found");
                        return;
                    }
        
                    // Fetch replies and retweets
                    const replies = tweet.thread;
                    const replyContext = replies
                        .filter((reply) => reply.username !== this.twitterUsername)
                        .map((reply) => `@${reply.username}: ${reply.text}`)
                        .join("\n");
        
                    let tweetBackground = "";
                    if (tweet.isRetweet) {
                        const originalTweet = await this.client.requestQueue.add(() =>
                            this.client.twitterClient.getTweet(tweet.id)
                        );
                        tweetBackground = `Retweeting @${originalTweet.username}: ${originalTweet.text}`;
                    }
        
                    // Generate image descriptions using GPT-4 vision API
                    const imageDescriptions = [];
                    for (const photo of tweet.photos) {
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
                        By @${tweet.username}
                        ${tweet.text}${replyContext.length > 0 && `\nReplies to original post:\n${replyContext}`}
                        ${`Original post text: ${tweet.text}`}
                        ${tweet.urls.length > 0 ? `URLs: ${tweet.urls.join(", ")}\n` : ""}${imageDescriptions.length > 0 ? `\nImages in Post (Described): ${imageDescriptions.join(", ")}\n` : ""}
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

                    elizaLogger.log(`Quote Content: ${response.text}`)
                    try {
                        const callback: HandlerCallback = async (response: Content) => {
                            const result = await this.client.requestQueue.add(
                                async () =>
                                    await this.client.twitterClient.sendQuoteTweet(
                                        response.text,
                                        tweet.id
                                    )
                            );
                            const body = await result.json();
                            const tweetResult = body?.data?.create_tweet?.tweet_results?.result;
                            if (!tweetResult){
                                elizaLogger.error("Failed to create quote tweet:", body);
                                return [];
                            }

                            const forwardedTweetsKey = `twitter/${this.client.profile.username}/forwardedTweets`;
                            const currentForwardedTweets = await this.runtime.cacheManager.get<any[]>(forwardedTweetsKey) || [];
                            
                            currentForwardedTweets.push({
                                originalTweet: state,
                                summary: response.text,
                                mediaContext: imageDescriptions,
                                analysis: relevanceResponse.trim(),
                                timestamp: Date.now()
                            });
                            
                            await this.runtime.cacheManager.set(forwardedTweetsKey, currentForwardedTweets);

                            const memory: Memory = {
                                id: stringToUuid(tweetResult.rest_id + "-" + this.runtime.agentId),
                                userId: this.runtime.agentId,
                                agentId: this.runtime.agentId,
                                roomId: message.roomId,
                                content: {
                                    text: response.text,
                                    url: `https://twitter.com/${this.twitterUsername}/status/${tweetResult.rest_id}`,
                                    source: "twitter",
                                    action: "quote",
                                },
                                createdAt: Date.now(),
                                embedding: getEmbeddingZeroVector()
                            };
                            return [memory];
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
        
                        this.respondedTweets.add(tweet.id);
                        const responseInfo = `Context:\n\n${context}\n\nSelected Post: ${tweet.id} - ${tweet.username}: ${tweet.text}\nAgent's Output:\n${response.text}`;
        
                        await this.runtime.cacheManager.set(
                            `twitter/tweet_generation_${tweet.id}.txt`,
                            responseInfo
                        );
        
                        await wait();
                    } catch (error) {
                        console.error(`Error sending response post: ${error}`);
                    }

                    elizaLogger.log(
                        `Bot would respond to tweet ${tweet.id} with: ${response.text}`
                    );
                }
            }
                
            // const prompt = `
            //     Here are some tweets:
            //     ${tweets.tweets
            //         .filter((tweet) => {
            //             // ignore tweets where any of the thread tweets contain a tweet by the bot
            //             const thread = tweet.thread;
            //             const botTweet = thread.find(
            //                 (t) => t.username === this.twitterUsername
            //             );
            //             return !botTweet;
            //         }).map(
            //             (tweet) => `
            //       ID: ${tweet.id}${tweet.quotedStatusId ? ` In reply to: ${tweet.quotedStatusId}` : ""}
            //       From: ${tweet.name} (@${tweet.username})
            //       Text: ${tweet.text}
            //     `
            //         ).join("\n")}

            //     Which one is the most relevant to these topics: Web3,空投,空投教程,IDO,ICO,${this.runtime.character.topics[this.searchIndex]}?

            //     Please return the index (1-based), only return the index, no other text.
            // `;

            // const mostInterestingTweetResponse = await generateText({
            //     runtime: this.runtime,
            //     context: prompt,
            //     modelClass: ModelClass.SMALL,
            // });

            
            // /*--------- modify -----------*/
            // const tweetId = parseInt(mostInterestingTweetResponse.trim());
            // const selectedTweet = slicedTweets[tweetId]; 
            // elizaLogger.log("Selected tweet:", selectedTweet);
            // /*----------------------------*/

            // modify
            this.searchIndex = (this.searchIndex + 1) % this.runtime.character.topics.length;
            
        } catch (error) {
            console.error("Error engaging with search terms:", error);
        }
    }

}
