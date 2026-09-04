#!/bin/bash
# Test script to verify Groq migration

echo "================================================"
echo "Groq Migration Test"
echo "================================================"
echo ""

echo "1. Checking .env.example..."
grep -q "GROQ_API_KEY" .env.example && echo "   ✓ GROQ_API_KEY found in .env.example" || echo "   ✗ GROQ_API_KEY not found"
grep -q "OPENAI_API_KEY" .env.example && echo "   ✗ Old OPENAI_API_KEY still present" || echo "   ✓ OPENAI_API_KEY removed"
echo ""

echo "2. Checking agent files for Groq API..."
for agent in agents/*.js; do
    if grep -q "groq.com/openai/v1" "$agent" && grep -q "groqKey" "$agent"; then
        echo "   ✓ $(basename $agent) uses Groq API"
    else
        echo "   ✗ $(basename $agent) not updated"
    fi
done
echo ""

echo "3. Checking model assignments..."
grep -q "openai/gpt-oss-120b" agents/writerAgent.js && echo "   ✓ Writer uses gpt-oss-120b" || echo "   ✗ Writer model incorrect"
grep -q "openai/gpt-oss-120b" agents/criticAgent.js && echo "   ✓ Critic uses gpt-oss-120b" || echo "   ✗ Critic model incorrect"
grep -q "openai/gpt-oss-20b" agents/researchAgent.js && echo "   ✓ Research uses gpt-oss-20b" || echo "   ✗ Research model incorrect"
grep -q "openai/gpt-oss-20b" agents/resumeParserAgent.js && echo "   ✓ Resume Parser uses gpt-oss-20b" || echo "   ✗ Resume Parser model incorrect"
grep -q "openai/gpt-oss-20b" agents/questionClassifierAgent.js && echo "   ✓ Classifier uses gpt-oss-20b" || echo "   ✗ Classifier model incorrect"
echo ""

echo "4. Checking server.js..."
grep -q "GROQ_API_KEY" server.js && echo "   ✓ Server uses GROQ_API_KEY" || echo "   ✗ Server not updated"
echo ""

echo "5. Checking for old OpenAI references (should be none)..."
OLD_REFS=$(grep -r "openai.*openai\.com" agents/*.js server.js 2>/dev/null | wc -l)
if [ "$OLD_REFS" -eq 0 ]; then
    echo "   ✓ No old OpenAI API URLs found"
else
    echo "   ✗ Found $OLD_REFS old OpenAI references"
fi
echo ""

echo "================================================"
echo "Migration Test Complete!"
echo "================================================"
