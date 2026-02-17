export interface ScoringPromptInput {
  role: string;
  rubric: Record<string, unknown>;
  interviewConversation: unknown[];
  prReviewComments: unknown[];
  prIssues: unknown[];
  behavioralSignals: unknown[];
}

export function buildScoringPrompt(input: ScoringPromptInput): string {
  const rubricText = JSON.stringify(input.rubric, null, 2);
  const interviewText = JSON.stringify(input.interviewConversation, null, 2);
  const prCommentsText = JSON.stringify(input.prReviewComments, null, 2);
  const prIssuesText = JSON.stringify(input.prIssues, null, 2);
  const behavioralText = JSON.stringify(input.behavioralSignals, null, 2);

  return `You are an expert technical hiring evaluator. Score a candidate for the role of ${input.role} using all available assessment data.

## Scoring Rubric
${rubricText}

## Interview Transcript
${interviewText}

## PR Review Exercise
The candidate was given a pull request containing intentional issues. Here are the known issues in the PR:
${prIssuesText}

The candidate's review comments:
${prCommentsText}

## Behavioral Signals
Passive observations collected during the assessment (typing rhythm, paste detection, tab focus, response timing):
${behavioralText}

## Instructions
Evaluate the candidate comprehensively and produce scores in three areas:

1. **Interview Score (0-100)**: Based on the interview transcript, evaluate technical knowledge, problem-solving ability, communication clarity, and depth of answers. If no interview data is available, set to null.

2. **PR Review Score (0-100)**: Based on the PR review comments, evaluate how many issues the candidate identified, the quality of their feedback, whether they caught security/bug/logic issues, and their ability to provide constructive suggestions. If no PR review data is available, set to null.

3. **Behavioral Score (0-100)**: Based on the behavioral signals, evaluate for authentic engagement. Look for red flags like excessive copy-pasting, suspiciously fast responses, frequent tab switching (possible cheating), or irregular typing patterns. A high score means the candidate appeared genuine. If no behavioral data is available, set to null.

4. **Overall Score (0-100)**: A weighted composite. Use weights: interview 40%, PR review 35%, behavioral 25%. Only include components that have data (non-null). Recalculate weights proportionally if some components are missing.

5. **Flags**: An array of string flags for notable observations. Possible flags include:
   - "bot-suspected" - behavioral patterns suggest automated responses
   - "copy-paste-heavy" - excessive clipboard usage detected
   - "tab-switching-frequent" - candidate frequently left the assessment tab
   - "fast-responder" - responses came unusually quickly
   - "slow-responder" - responses took unusually long
   - "thorough-reviewer" - caught most or all PR issues
   - "surface-reviewer" - only caught obvious issues
   - "strong-communicator" - interview answers were clear and well-structured
   - "needs-depth" - answers lacked technical depth

Respond with ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "interview_score": 85,
  "pr_review_score": 72,
  "behavioral_score": 90,
  "overall_score": 82.3,
  "reasoning": "Detailed paragraph explaining the scoring rationale, strengths, and areas for improvement.",
  "flags": ["thorough-reviewer", "strong-communicator"],
  "breakdown": {
    "interview": {
      "technical_knowledge": 80,
      "problem_solving": 85,
      "communication": 90,
      "notes": "Brief notes on interview performance"
    },
    "pr_review": {
      "issues_found": 4,
      "issues_total": 6,
      "feedback_quality": 75,
      "security_awareness": 70,
      "notes": "Brief notes on PR review performance"
    },
    "behavioral": {
      "authenticity": 90,
      "engagement": 85,
      "notes": "Brief notes on behavioral observations"
    }
  }
}`;
}
