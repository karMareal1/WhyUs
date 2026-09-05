# WhyUs

A Chrome extension that drafts tailored, specific answers to job application essay questions like "Why do you want to work for us?" using a 5-agent AI architecture.

## 🎯 What It Does

Job applications often include open-ended essay questions that autofill tools can't handle. WhyUs generates **specific, non-generic** answers grounded in:
- Your actual resume (experience, skills, achievements)
- Current public facts about the company (mission, news, products, culture)

No more generic "I'm passionate about innovation" fluff. WhyUs produces answers with real facts, metrics, and genuine connections.

## 🏗️ Architecture

### 5 Specialized Agents (Not a Single Prompt)

Each agent has one job and passes structured JSON to the next:

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                              │
│  (Coordinates agents, manages parallel execution, caching)   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐        ┌─────────┐        ┌──────────┐
   │Research │        │Resume   │        │Question  │
   │Agent    │        │Parser   │        │Classifier│
   └─────────┘        └─────────┘        └──────────┘
        │                   │                   │
        │  CompanyBrief     │  CandidateBrief   │  QuestionSpec
        └───────────────────┴───────────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │Writer Agent │
                     └─────────────┘
                            │
                            │ Draft
                            ▼
                     ┌─────────────┐
                     │Critic Agent │──┐
                     └─────────────┘  │
                            │         │ rewrite
                            │ Critique│ (max 1x)
                            ▼         │
                        FINAL DRAFT◄──┘
```

#### 1. Research Agent
- **Input**: Company name + optional role
- **Tools**: Web search + page fetch
- **Output**: `CompanyBrief` with mission, recent news, products, values, culture (all sourced)
- **Rule**: Never invent company facts

#### 2. Resume Parser Agent
- **Input**: Resume file (PDF/DOCX/TXT) + company context
- **Tools**: PDF-parse, Mammoth (DOCX), LLM extraction
- **Output**: `CandidateBrief` with relevant experience, skills, education
- **Rule**: Never invent jobs or metrics

#### 3. Question Classifier Agent
- **Input**: Essay question text
- **Tools**: LLM classification
- **Output**: `QuestionSpec` with intent (why_company/why_role/culture_fit/why_you/mixed), expected length, register
- **Rule**: Fast, focused classification

#### 4. Writer Agent
- **Input**: CompanyBrief + CandidateBrief + QuestionSpec
- **Tools**: LLM generation (GPT-4o)
- **Output**: `Draft` with specific, first-person answer + citations
- **Rules**: 
  - No generic phrases ("passionate about", "excited to contribute")
  - Use actual company facts (products, news, mission)
  - Use actual candidate achievements with metrics
  - Natural, human tone

#### 5. Critic/QA Agent
- **Input**: Draft + all briefs
- **Tools**: LLM review (GPT-4o)
- **Output**: `Critique` with genericness score (0-10), factual support check, templated phrasing detection
- **Decision**: Approve OR request one concrete rewrite (Writer runs once more)

### JSON Schemas

All agent handoffs use typed JSON schemas defined in `/backend/schemas.js`:

- **CompanyBrief**: `{ companyName, mission, recentNews[], products[], values[], culture, sources[] }`
- **CandidateBrief**: `{ relevantExperience[], skills[], education[], keyStrengths[] }`
- **QuestionSpec**: `{ intent, expectedLength, register, originalQuestion }`
- **Draft**: `{ text, wordCount, citations[] }`
- **Critique**: `{ approved, genericnessScore, factualSupport, templatedPhrasing[], rewriteRequest?, finalDraft }`

### Performance: Parallel Execution

```
Phase 1 (Parallel):  Research + Resume Parse + Question Classify  →  ~3-5s
Phase 2 (Serial):    Writer                                        →  ~2-3s
Phase 3 (Serial):    Critic                                        →  ~2-3s
Phase 4 (Optional):  Writer rewrite (if needed)                    →  ~2-3s
─────────────────────────────────────────────────────────────────────────
Total:               ~7-14s for end-to-end generation
```

Company research is cached (1 hour TTL) for repeated queries to same company.

## 🔧 Tech Stack

### Backend
- **Runtime**: Node.js (ES modules)
- **Framework**: Express
- **LLM**: Groq API with openai/gpt-oss-120b (Writer, Critic), openai/gpt-oss-20b (other agents)
- **Resume Parsing**: pdf-parse, mammoth
- **Web Research**: node-fetch (ready for search API integration)

### Extension
- **Manifest**: V3
- **UI**: Vanilla HTML/CSS/JS (no build step needed)
- **Storage**: Chrome Storage API (resume caching, settings)
- **Communication**: Content scripts for text selection detection

## 🚀 Setup & Usage

### Prerequisites

- Node.js 18+ 
- Groq API key (free tier available at https://console.groq.com/keys)
- Chrome browser

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your free Groq API key:
# GROQ_API_KEY=gsk_...

# Start server
npm start

# Server runs at http://localhost:3000
```

**Test the backend:**

```bash
# Health check
curl http://localhost:3000/health

# Test with sample resume
curl http://localhost:3000/api/test
```

### 2. Extension Setup

```bash
# 1. Open Chrome and go to chrome://extensions/
# 2. Enable "Developer mode" (toggle in top right)
# 3. Click "Load unpacked"
# 4. Select the /extension folder from this repo
# 5. Extension should appear with WhyUs icon
```

### 3. Using WhyUs

1. **Navigate to a job application** with an essay question
2. **Click the WhyUs extension icon** in Chrome toolbar
3. **Enter the question** (or highlight it on the page and click "Use Selected Text")
4. **Enter company name** (or click "Auto-detect from page")
5. **Upload your resume** (PDF, DOCX, or TXT - max 5MB)
   - Resume is cached locally for reuse
6. **Click "Generate Answer"**
7. **Wait 5-15 seconds** for the 5-agent pipeline to run
8. **Review the draft**:
   - Word count shown
   - Quality score (genericness check)
   - Warnings about generic phrases or unsupported claims
9. **Copy to clipboard** and paste into application

### Backend API

#### `POST /api/generate`

Generate a tailored essay answer.

**Request:**
```json
{
  "question": "Why do you want to work at Google?",
  "companyName": "Google",
  "role": "Software Engineer",
  "resumeData": "base64-encoded-resume-file",
  "resumeFileType": "pdf"
}
```

**Response:**
```json
{
  "success": true,
  "draft": "Working at Google appeals to me because...",
  "critique": {
    "approved": true,
    "genericnessScore": 3,
    "templatedPhrasing": [],
    "unsupportedClaims": []
  },
  "metadata": {
    "companyBrief": { ... },
    "candidateBrief": { ... },
    "questionSpec": { ... },
    "wordCount": 156,
    "citations": [ ... ],
    "timings": {
      "phase1_parallel": 3200,
      "phase2_writer": 2400,
      "total": 7800
    }
  }
}
```

#### `GET /api/test`

Test endpoint with built-in sample resume and question.

#### `GET /health`

Health check - returns API key configuration status.

## 📁 Project Structure

```
WhyUs/
├── backend/
│   ├── agents/
│   │   ├── researchAgent.js      # Web research for company info
│   │   ├── resumeParserAgent.js  # Parse and extract from resume
│   │   ├── questionClassifierAgent.js  # Classify question intent
│   │   ├── writerAgent.js        # Generate draft answer
│   │   └── criticAgent.js        # Review and QA draft
│   ├── orchestrator.js           # Coordinates all agents
│   ├── schemas.js                # JSON schemas for handoffs
│   ├── server.js                 # Express API server
│   ├── package.json
│   └── .env.example
│
├── extension/
│   ├── manifest.json             # Chrome extension manifest (V3)
│   ├── popup.html                # Extension popup UI
│   ├── popup.css                 # Styles
│   ├── popup.js                  # UI logic, API calls
│   ├── content.js                # Content script (text selection)
│   ├── background.js             # Service worker
│   └── icons/                    # Extension icons (16, 48, 128px)
│
└── README.md                     # This file
```

## 🎓 Writing Quality Bar

WhyUs is designed to produce **specific, sourced, human-sounding** answers:

✅ **Good Answer Example:**
> "I'm drawn to Stripe's focus on economic infrastructure—I built a payment processing pipeline at TechCorp that handled $2M in transactions monthly, and I'm excited to work on similar challenges at global scale. Your recent launch of Stripe Tax aligns with my interest in regulatory automation."

❌ **Generic Answer (Rejected):**
> "I'm passionate about innovation and excited to contribute to your dynamic team. I believe I would be a great fit because of my strong work ethic and ability to think outside the box."

### Quality Checks

The Critic Agent flags:
1. **Genericness Score**: 0-10 (must be ≤4 for approval)
2. **Unsupported Claims**: Facts not in company brief or resume
3. **Templated Phrasing**: "passionate about", "excited to", "dynamic environment", etc.

If rejected, Writer gets **one concrete rewrite instruction** and tries again.

## 🔒 Security & Privacy

- **API keys never in extension**: All LLM calls happen on your backend server
- **Resume stored locally**: Chrome Storage API (local to your browser)
- **No data sent to third parties**: Only to your backend and OpenAI API
- **Backend runs locally**: You control the server and data

## 🧪 Testing

### Manual Test Flow

1. Start backend: `cd backend && npm start`
2. Load extension in Chrome
3. Test with sample application:
   - Question: "Why do you want to work at Stripe?"
   - Company: "Stripe"
   - Role: "Software Engineer"
   - Upload a real resume (PDF/DOCX/TXT)
4. Click Generate
5. Verify:
   - Generation completes in <15s
   - Draft includes specific company facts (Stripe's products, mission)
   - Draft includes specific resume facts (your actual experience)
   - No generic phrases flagged
   - Word count appropriate (100-200 words typically)

### API Testing

```bash
# Test with sample resume
curl -X GET http://localhost:3000/api/test | jq .

# Test with custom data
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Why Amazon?",
    "companyName": "Amazon",
    "resumeData": "'"$(base64 -w0 my_resume.pdf)"'",
    "resumeFileType": "pdf"
  }' | jq .
```

## 🚧 Known Limitations (MVP)

1. **Web Search**: Currently using mock search results. For production, integrate real search API (Google Custom Search, Bing, etc.)
2. **Icons**: Placeholder icons included. Replace with proper design for production.
3. **Rate Limiting**: No rate limiting on API. Add for production deployment.
4. **Resume Size**: 5MB limit. Sufficient for text documents.
5. **Caching**: Simple in-memory cache (clears on server restart). Use Redis for production.

## 🔧 Troubleshooting

### Extension shows error or can't connect to backend

1. **Check backend is running**: Make sure you started the backend server with `npm start` in the `backend/` folder
2. **Check backend URL**: In extension settings, verify the backend URL is `http://localhost:3000`
3. **Check browser console**: Right-click extension popup → Inspect → Console tab for error details

### Generation fails with API errors

1. **Check Groq API key**:
   ```bash
   curl http://localhost:3000/health
   # Should show: "groq": true
   ```
   
2. **Verify API key in backend/.env**:
   ```bash
   # Make sure GROQ_API_KEY is set correctly
   GROQ_API_KEY=gsk_...
   ```

3. **Check backend terminal logs**: Look for detailed error messages in the terminal where you ran `npm start`

### Common Groq API errors

- **401 Unauthorized**: Invalid API key. Get a new one at https://console.groq.com/keys
- **429 Rate Limit**: Free tier rate limit exceeded. Wait a few minutes or upgrade to paid tier
- **400 Bad Request**: Usually means the model name is invalid or deprecated
- **Empty response**: Groq returned no content. This is now caught and reported as an error

### If you see "Unable to generate draft" message

This used to be shown as a "success" but is actually an error. This has been fixed - you should now see a proper error message with the real reason (API key issue, rate limit, etc.).

Check:
1. Backend terminal logs for the actual error
2. `/health` endpoint shows API key is configured
3. Your Groq API key is valid and has available quota
7. **Free Tier Limits**: Groq free tier has rate limits. For high-volume production, consider paid tier or alternative providers.

## 🔮 Future Enhancements

- [ ] Real web search API integration
- [ ] Support for more LLM providers (OpenAI, Anthropic, local models)
- [ ] Browser extension for Firefox, Edge
- [ ] Save/manage multiple drafts
- [ ] Export to various formats
- [ ] Fine-tune detection of company info from LinkedIn, Glassdoor
- [ ] Support for multiple languages
- [ ] Integration with application platforms (Workday, Greenhouse, etc.)
- [ ] Rate limiting and caching for production scale

## 📝 Development Notes

### Agent Design Principles

1. **Single Responsibility**: Each agent has one clear job
2. **Structured Handoffs**: JSON schemas enforce contracts
3. **No Invented Facts**: Agents never hallucinate data
4. **Fast & Cheap**: Use smaller models where possible (openai/gpt-oss-20b for Research, Resume, Classifier)
5. **Quality Where It Matters**: Use best model (openai/gpt-oss-120b) for Writer and Critic
6. **Free Tier Friendly**: Groq provides free API access for hackathon demos

### Prompt Engineering

All agent prompts follow this pattern:
- Clear role definition
- Structured input context
- Explicit output JSON schema
- **CRITICAL RULES** section with constraints
- Low temperature for factual tasks (0.1-0.3)
- Higher temperature for creative writing (0.7)
- OpenAI-compatible API calls via Groq's free tier

### Latency Optimization

- Parallel execution: Research + Resume + Classifier run simultaneously
- Company caching: Same company research reused for 1 hour
- Token budgets: Strict max_tokens limits per agent
- Model selection: gpt-oss-20b for speed (Research, Resume, Classifier), gpt-oss-120b where quality critical (Writer, Critic)
- Groq's blazing fast inference: 900+ tokens/sec on smaller models

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

This is a hackathon project. Feel free to fork and improve!

Key areas for contribution:
- Real web search integration
- Better company detection algorithms
- UI/UX improvements
- Additional LLM provider support (OpenAI, Anthropic, etc.)
- Test coverage
- Production-ready rate limiting and error handling

## 💡 Credits

Built for the WhyUs hackathon challenge. Inspired by the pain of writing dozens of "Why this company?" essays during job hunts.

---

**Questions?** Open an issue or check the code comments in `/backend/agents/` for detailed agent logic.
