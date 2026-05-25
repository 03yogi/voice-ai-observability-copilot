export const EVALUATION_SYSTEM = `You are a Voice AI observability analyst for HighLevel call centers.
Evaluate ONE completed call session using the user's evaluation criteria and the agent's configured instructions.
Return ONLY valid JSON matching the schema. Every KPI failure must cite a short quote from the transcript as evidence.
Derive KPIs from the evaluation criteria and agent instructions — do not assume fixed fields unless the criteria require them.
Also include 1-3 actionable suggestions specific to THIS call — each must reference what happened in the transcript.`;

export function buildEvaluationUserPrompt({ agent, call, evaluationPrompt }) {
  const extracted = call.extracted_data
    ? JSON.parse(call.extracted_data)
    : {};

  return JSON.stringify(
    {
      task: 'Evaluate this call session',
      evaluationCriteria: evaluationPrompt,
      agent: {
        name: agent.name,
        businessName: agent.business_name,
        welcomeMessage: agent.welcome_message,
        instructionsFromHighLevel: agent.agent_prompt,
      },
      call: {
        durationSec: call.duration_sec,
        summary: call.summary,
        extractedDataFromPlatform: extracted,
        transcript: call.transcript,
        transcriptTurns: call.transcript_json ? JSON.parse(call.transcript_json) : [],
      },
      outputSchema: {
        overallScore: 'integer 0-100',
        kpiResults: [
          {
            kpi: 'string id',
            label: 'string',
            pass: 'boolean',
            evidence: 'string with transcript quote',
            severity: 'high|medium|none',
          },
        ],
        deviations: [
          { id: 'string', label: 'string', evidence: 'string', severity: 'high|medium|low' },
        ],
        useActions: [
          {
            startSec: 'number|null',
            endSec: 'number|null',
            label: 'string',
            reason: 'string',
            priority: 'high|medium|low',
          },
        ],
        suggestions: [
          {
            type: 'prompt_edit|script_addition|agent_behavior|human_workflow',
            title: 'string',
            body: 'string — what went wrong in this call and how to fix it',
            examplePromptSnippet: 'string — optional revised script line',
            impact: 'high|medium|low',
          },
        ],
      },
    },
    null,
    2,
  );
}

export const RECOMMENDATIONS_SYSTEM = `You are a Voice AI optimization copilot.
Given an agent's instructions and recent call evaluations, produce actionable prompt/script recommendations.
Return ONLY valid JSON as an object with an "items" array (1-5 recommendations).
Each item must reference patterns seen in the provided calls.`;

export function buildRecommendationsUserPrompt({ agent, calls }) {
  const callSummaries = calls.map((c) => ({
    startedAt: c.started_at,
    durationSec: c.duration_sec,
    overallScore: c.overall_score,
    summary: c.summary,
    kpiResults: c.kpi_results ? JSON.parse(c.kpi_results) : [],
    deviations: c.deviations ? JSON.parse(c.deviations) : [],
    transcriptExcerpt: (c.transcript || '').slice(0, 1200),
  }));

  return JSON.stringify(
    {
      task: 'Generate agent-level recommendations',
      agent: {
        name: agent.name,
        businessName: agent.business_name,
        instructions: agent.agent_prompt,
      },
      recentCalls: callSummaries,
      outputSchema: {
        items: [
          {
            type: 'prompt_edit|script_addition|agent_behavior|human_workflow',
            title: 'string',
            body: 'string',
            examplePromptSnippet: 'string',
            impact: 'high|medium|low',
          },
        ],
      },
    },
    null,
    2,
  );
}
