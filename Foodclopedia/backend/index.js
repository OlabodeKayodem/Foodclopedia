import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import cors from 'cors';
import { AzureKeyCredential, OpenAIClient } from '@azure/openai';

dotenv.config();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  optionsSuccessStatus: 200,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const azureOpenaiKey = process.env.AZURE_OPENAI_KEY;
const model = process.env.AZURE_OPENAI_MODEL_ID;
const azureOpenaiEndpoint = process.env.AZURE_OPENAI_URL;
const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
const searchKey = process.env.AZURE_SEARCH_KEY;
const searchIndex = process.env.AZURE_SEARCH_INDEX;

const openaiClient = new OpenAIClient(azureOpenaiEndpoint, new AzureKeyCredential(azureOpenaiKey));

app.get('/', (_, response) => {
  response.send("<h1>It works! Go to https://foodclopediang.azurewebsites.net/chat to access the API</h1>");
});

app.get("/chat", (_, response) => {
  response.send("<h1>This is a GET request. You should be making a POST request instead</h1>");
});

app.post('/chat', async (request, response) => {
  try {
    const chunks = await openaiClient.streamChatCompletions(model, request.body.messages, {
      azureExtensionOptions: {
        extensions: [
          {
            type: 'AzureCognitiveSearch',
            endpoint: searchEndpoint,
            key: searchKey,
            indexName: searchIndex,
          },
        ],
      },
    });

    // Set response headers for streaming
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Transfer-Encoding', 'chunked');
    response.setHeader('Connection', 'keep-alive');

    for await (const chunk of chunks) {
      response.write(JSON.stringify(chunk) + '\n');
    }

    response.end();
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Listening on http://${process.env.HOST}:${process.env.PORT}`);
});
