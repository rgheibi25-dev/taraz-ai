const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const GHOST_URL = process.env.GHOST_URL;
const GHOST_API_KEY = process.env.GHOST_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// دریافت محتوای تمام پست‌ها از Ghost
async function getAllPosts() {
    try {
        const response = await axios.get(`${GHOST_URL}/ghost/api/content/posts/`, {
            params: {
                key: GHOST_API_KEY,
                limit: 'all',
                fields: 'title,html,excerpt'
            }
        });
        return response.data.posts;
    } catch (error) {
        console.error('Error fetching posts from Ghost:', error);
        return [];
    }
}

app.post('/chat', async (req, res) => {
    const { message } = req.body;

    try {
        // 1. دریافت محتوای سایت
        const posts = await getAllPosts();
        const context = posts.map(p => `Title: ${p.title}\nContent: ${p.excerpt}`).join('\n\n');

        // 2. ارسال به OpenAI برای پاسخ‌دهی بر اساس محتوا
        const aiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are the AI assistant for Taraz, an analytical observatory. Answer the user's question ONLY based on the following context from Taraz's articles. If the answer is not in the context, politely say you don't know and suggest they contact Taraz. Respond in Persian.\n\nContext:\n${context.substring(0, 3000)}`
                },
                { role: "user", content: message }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        });

        res.json({ reply: aiResponse.data.choices[0].message.content });
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Taraz AI Server running on port ${PORT}`));
