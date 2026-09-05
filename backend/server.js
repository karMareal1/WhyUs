import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Orchestrator } from './orchestrator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Initialize orchestrator with API keys
const apiKeys = {
  groq: process.env.GROQ_API_KEY
};

if (!apiKeys.groq) {
  console.warn('WARNING: GROQ_API_KEY not set in environment variables');
}

const orchestrator = new Orchestrator(apiKeys);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeysConfigured: {
      groq: !!apiKeys.groq
    }
  });
});

// Main generation endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { question, companyName, role, resumeData, resumeFileType } = req.body;

    // Validate required fields
    if (!question || !companyName || !resumeData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, companyName, resumeData'
      });
    }

    // Convert base64 resume data to buffer
    const resumeBuffer = Buffer.from(resumeData, 'base64');

    // Run orchestration
    const result = await orchestrator.generate({
      question,
      companyName,
      role: role || null,
      resumeBuffer,
      resumeFileType: resumeFileType || 'pdf'
    });

    // If orchestration failed internally, return 500
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint with sample data
app.get('/api/test', async (req, res) => {
  try {
    // Sample test data
    const sampleResume = Buffer.from(`
JOHN DOE
Software Engineer

EXPERIENCE
Senior Software Engineer at TechCorp (2021-Present)
- Led development of microservices architecture serving 10M+ users
- Reduced API latency by 40% through optimization
- Mentored team of 5 junior engineers

Software Engineer at StartupXYZ (2019-2021)
- Built real-time data pipeline processing 1TB+ daily
- Implemented CI/CD pipeline reducing deployment time by 60%

EDUCATION
BS Computer Science, University of Technology (2019)

SKILLS
Python, JavaScript, Node.js, React, PostgreSQL, Docker, AWS
    `.trim(), 'utf-8');

    const result = await orchestrator.generate({
      question: "Why do you want to work at Google?",
      companyName: "Google",
      role: "Software Engineer",
      resumeBuffer: sampleResume,
      resumeFileType: 'txt'
    });

    res.json(result);

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear cache endpoint (for development)
app.post('/api/cache/clear', (req, res) => {
  orchestrator.clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 WhyUs Backend Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🔑 Groq API Key: ${apiKeys.groq ? 'Configured ✓' : 'Missing ✗'}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health          - Health check`);
  console.log(`  POST /api/generate    - Generate essay`);
  console.log(`  GET  /api/test        - Test with sample data`);
  console.log(`  POST /api/cache/clear - Clear company cache\n`);
});
