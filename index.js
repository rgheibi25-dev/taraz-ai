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

async function getAllPosts() {
    try {
        const response = await axios.get(`${GHOST_URL}/ghost/api/content/posts/`, {
            params: {
                key: GHOST_API_KEY,
                limit: 'all',
                fields: 'title,excerpt'
            }
        });
        return response.data.posts;
    } catch (error) {
        console.error('Ghost API Error:', error.response ? error.response.data : error.message);
        return [];
    }
}

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const posts = await getAllPosts();
        const context = posts.length > 0 
            ? posts.map(p => `Title: ${p.title}\nContent: ${p.excerpt}`).join('\n\n')
            : "No specific articles found.";

        const aiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are the AI assistant for Taraz. Answer based on this context: ${context.substring(0, 3000 )}`
                },
                { role: "user", content: message }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        });

        res.json({ reply: aiResponse.data.choices[0].message.content });
    } catch (error) {
        // این بخش حالا خطای واقعی را در لاگ‌های Render چاپ می‌کند
        console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI Service Error", details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
