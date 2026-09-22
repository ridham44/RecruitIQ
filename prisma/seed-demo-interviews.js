// Demo/sample data for the Phase 3 AI Voice Interview system: 3 completed
// interviews (different performance tiers, different questions/answers,
// different scores, different transcripts, different events) so the
// recruiter dashboard can demonstrate the full interview → transcript →
// evaluation → report → events flow without waiting on a real interview.
//
// Builds ON TOP of the existing prisma/seed.js demo dataset (same
// "Ravantra Technologies" company, same "React.js Developer" job, and
// reuses 3 of its existing candidates — Priya Sharma, Ridham Patel, Riya
// Mehta — since their real resumes already fit the requested performance
// narratives). Run `npm run db:seed` first if those don't exist yet.
//
// Marked clearly as demo data: the underlying company/candidate accounts
// are already the seed's obviously-fake @example.com / @...demo addresses,
// and every AI-authored field below sets `aiModel: 'demo-seed-data'`
// instead of a real model name (screening.aiModel is shown on the
// candidate detail page in the app UI, making this visible to recruiters).
//
// Deliberately does NOT call OpenRouter — same reproducibility rationale
// as prisma/seed.js.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_MODEL_TAG = 'demo-seed-data';

const COMPANY_EMAIL = 'company@ravantratech.demo';
const JOB_TITLE = 'React.js Developer';

const AI_CONFIG = {
  aiName: 'Aria',
  aiTitle: 'Virtual HR',
  questionCount: 8,
  answerTimeSeconds: 30,
  customQuestions: ['Why do you want to work with our team specifically?'],
  voiceGender: 'FEMALE',
  ttsVoiceId: null,
  difficultyStrategy: 'ADAPTIVE',
};

const CUSTOM_QUESTION_TEXT = AI_CONFIG.customQuestions[0];

function introText(candidateFirstName) {
  return `Hi ${candidateFirstName}, I'm ${AI_CONFIG.aiName}, ${AI_CONFIG.aiTitle} at Ravantra Technologies. Thanks for joining — let's get started. Could you briefly introduce yourself and walk me through your background?`;
}

// ─────────────────────────────────────────────────────────────
// Candidate 1: Priya Sharma — Very Poor
// Resume looks solid (2.5 yrs, React/Redux/Jest) but the live interview
// reveals she can't actually explain the concepts her resume claims —
// a deliberate "resume screening isn't the whole picture" demo beat.
// ─────────────────────────────────────────────────────────────
const PRIYA = {
  email: 'priya.sharma@example.com',
  firstName: 'Priya',
  screening: {
    overallScore: 72,
    skillMatchScore: 60,
    experienceMatchScore: 100,
    educationMatchScore: 95,
    matchedSkills: ['React', 'JavaScript', 'REST API'],
    missingSkills: ['HTML', 'CSS'],
    strengths: ['2.5 years of React experience listed', 'Familiar with Redux Toolkit and Jest'],
    concerns: ['Resume lists HTML5/CSS3 rather than the exact required HTML/CSS tags'],
    reasoning:
      'Strong resume match on paper — React, JavaScript, Redux Toolkit, and REST API integration experience align well with the role. Recommended for interview.',
  },
  resumeAlignment: {
    requiredSkillsMatched: ['React', 'JavaScript', 'REST API'],
    requiredSkillsMissing: ['HTML', 'CSS'],
    requiredSkillMatchScore: 60,
    preferredSkillsMatched: ['Redux', 'TypeScript', 'Git'],
    preferredSkillMatchScore: 75,
  },
  turns: [
    {
      kind: 'INTRODUCTION',
      text: introText('Priya'),
      transcript: "Hi, I'm Priya Sharma, I've been working as a frontend developer for about two and a half years, mostly with React. Happy to be here.",
      durationSeconds: 14,
    },
    {
      kind: 'PLANNED',
      stage: 'RESUME_QUESTIONS',
      type: 'RESUME_BASED',
      difficulty: 'MEDIUM',
      text: "I see you led a migration from class components to functional components with hooks at Tech Nova Solutions — what motivated that migration, and what was the trickiest part of moving state logic into hooks?",
      rawTranscript:
        "Um, we just wanted to update the code to be more modren I think. Hooks are basically the same as normal functions so we just changed the class to a function. I don't remember any specific issues, it was mostly straightforward for me, my senior handled the harder parts.",
      normalizedTranscript:
        "We just wanted to update the code to be more modern I think. Hooks are basically the same as normal functions so we just changed the class to a function. I don't remember any specific issues, it was mostly straightforward for me, my senior handled the harder parts.",
      durationSeconds: 22,
      relevance: 35,
      missingConcepts: ['lifecycle-to-hook mapping', 'state migration challenges'],
      note: 'Vague, deflects difficulty onto a senior colleague; no real technical detail.',
      analysis: {
        correctness: 25,
        technicalDepth: 15,
        communication: 55,
        strengths: [],
        missingConcepts: ['componentDidMount/componentDidUpdate -> useEffect mapping', 'shared state extraction challenges'],
        evaluationReason: 'Could not explain any specifics of a migration her own resume claims she led; answer is generic and non-technical.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'BASIC_TECHNICAL',
      type: 'TECHNICAL',
      difficulty: 'EASY',
      text: 'Can you explain the difference between useState and useEffect in React?',
      transcript:
        "useState is for effects and useEffect is for state I think... actually I get confused between them sometimes. I usually just copy patterns from other components that already work.",
      durationSeconds: 18,
      relevance: 20,
      missingConcepts: ['useState purpose (local state)', 'useEffect purpose (side effects/lifecycle)'],
      note: 'Definitions swapped; admits confusion and relies on copy-pasting.',
      analysis: {
        correctness: 15,
        technicalDepth: 10,
        communication: 50,
        strengths: ['Honest about the gap rather than bluffing confidently'],
        missingConcepts: ['useState purpose', 'useEffect purpose', 'when each hook runs'],
        evaluationReason: 'Swapped the two hooks\' purposes entirely — a fundamental React concept this role requires day one.',
      },
      followUp: {
        text: "That's alright — let's try a simpler angle: if you wanted a component to run some code every time it renders, which of the two would you reach for?",
        transcript: "...useState? I'm not fully sure, sorry, I get mixed up on this one.",
        durationSeconds: 10,
        relevance: 15,
        missingConcepts: ['useEffect as the render-triggered side-effect hook'],
        note: 'Still incorrect on the simplified version of the same question.',
        analysis: {
          correctness: 10,
          technicalDepth: 10,
          communication: 45,
          strengths: [],
          missingConcepts: ['useEffect'],
          evaluationReason: 'Could not answer correctly even after the question was simplified — suggests a real gap, not just nerves.',
        },
      },
    },
    {
      kind: 'CUSTOM',
      text: CUSTOM_QUESTION_TEXT,
      transcript: 'I think Ravantra has interesting projects and I want to grow my React skills further here.',
      durationSeconds: 9,
      analysis: {
        correctness: 50,
        relevance: 70,
        technicalDepth: 40,
        communication: 65,
        score: 60,
        strengths: ['Genuine, on-topic answer'],
        missingConcepts: [],
        evaluationReason: 'Reasonable, if generic, motivational answer — not a technical question.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'JOB_SPECIFIC',
      type: 'JOB_SPECIFIC',
      difficulty: 'EASY',
      text: "This role involves integrating REST APIs into dashboards — can you walk me through how you'd handle an API call that sometimes fails or times out?",
      transcript:
        "I would just call the API again and again until it works. I haven't really had to handle errors much, the backend team usually tells us if something is wrong.",
      durationSeconds: 16,
      relevance: 25,
      missingConcepts: ['retry/backoff strategy', 'error boundaries', 'user-facing failure feedback'],
      note: 'No real error-handling strategy; relies entirely on other team members.',
      analysis: {
        correctness: 20,
        technicalDepth: 15,
        communication: 50,
        strengths: [],
        missingConcepts: ['retry/backoff', 'try/catch or error boundary', 'user feedback on failure'],
        evaluationReason: "\"Call it again and again\" is not a real retry strategy, and there's no mention of surfacing errors to the user.",
      },
    },
    {
      kind: 'PLANNED',
      stage: 'SCENARIO',
      type: 'SCENARIO',
      difficulty: 'EASY',
      text: 'Imagine a component re-renders too often and the app feels sluggish — what would you check first?',
      transcript: "Maybe the internet is slow? Or the API is slow. I'm not sure what re-render actually means exactly in this context.",
      durationSeconds: 13,
      relevance: 15,
      missingConcepts: ['re-render triggers (state/props changes)', 'profiling before optimizing'],
      note: "Confuses network latency with a rendering-performance question — doesn't understand what a re-render is.",
      analysis: {
        correctness: 10,
        technicalDepth: 10,
        communication: 45,
        strengths: [],
        missingConcepts: ['what causes a re-render', 'React DevTools profiler'],
        evaluationReason: "Doesn't understand the core concept of a component re-render, which the question was directly probing for.",
      },
    },
    {
      kind: 'PLANNED',
      stage: 'BEHAVIORAL',
      type: 'BEHAVIORAL',
      difficulty: 'EASY',
      text: 'Tell me about a time you had to learn a new technology quickly for a project.',
      transcript:
        "When we added Jest for testing, I hadn't used it before, so I watched a few tutorial videos over a weekend and then just tried writing tests alongside my senior's existing ones until it made sense.",
      durationSeconds: 20,
      relevance: 55,
      missingConcepts: [],
      note: 'Reasonable, believable story — not a technical question.',
      analysis: {
        correctness: 55,
        technicalDepth: 30,
        communication: 60,
        strengths: ['Shows willingness to self-teach with structure (tutorials, then practice)'],
        missingConcepts: [],
        evaluationReason: 'A believable, moderately concrete example of learning under guidance.',
      },
    },
    {
      kind: 'CANDIDATE_QUESTIONS',
      text: "That covers everything on my side. Do you have any questions for us about the role or Ravantra Technologies?",
      transcript: "No, I think that's all, thank you.",
      durationSeconds: 5,
      analysis: {
        correctness: 50,
        relevance: 50,
        technicalDepth: 30,
        communication: 55,
        score: 50,
        strengths: [],
        missingConcepts: [],
        evaluationReason: 'Declined to ask anything — a missed opportunity to show engagement.',
      },
    },
  ],
  report: {
    overallScore: 38,
    technicalScore: 24,
    communicationScore: 55,
    strengths: [
      'Polite, cooperative communication style throughout',
      'Honest about gaps rather than bluffing with false confidence',
    ],
    areasForImprovement: [
      'Confuses fundamental React hook concepts (useState vs. useEffect)',
      "Cannot explain how her own resume-listed hooks migration was actually done",
      'No practical strategy for handling failed or slow API calls',
      'Does not understand what triggers a component re-render',
    ],
    reasoning:
      "Priya's resume suggests solid, hands-on React experience, but her live interview revealed significant gaps in fundamental concepts — she swapped the definitions of useState and useEffect, could not answer even a simplified follow-up on the same topic, and had no real strategy for API error handling or diagnosing rendering performance issues. She remained polite and honest throughout rather than bluffing, but technical depth was well below what this role requires.",
  },
};

// ─────────────────────────────────────────────────────────────
// Candidate 2: Ridham Patel — Good
// ─────────────────────────────────────────────────────────────
const RIDHAM = {
  email: 'ridham.patel@example.com',
  firstName: 'Ridham',
  screening: {
    overallScore: 78,
    skillMatchScore: 80,
    experienceMatchScore: 100,
    educationMatchScore: 90,
    matchedSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
    missingSkills: ['REST API'],
    strengths: ['Solid React fundamentals for a junior profile', 'Direct hands-on component-building experience'],
    concerns: ['Resume does not explicitly list REST API as a named skill, though experience mentions API integration'],
    reasoning: 'Good core skill match for a junior-to-mid React role. Recommended for interview.',
  },
  resumeAlignment: {
    requiredSkillsMatched: ['React', 'JavaScript', 'HTML', 'CSS'],
    requiredSkillsMissing: ['REST API'],
    requiredSkillMatchScore: 80,
    preferredSkillsMatched: ['Git'],
    preferredSkillMatchScore: 25,
  },
  turns: [
    {
      kind: 'INTRODUCTION',
      text: introText('Ridham'),
      transcript:
        "Hey, I'm Ridham Patel. I've spent a bit over a year as a junior web developer working mostly with React, building components and hooking up a few third-party APIs. Excited to talk through some of that.",
      durationSeconds: 15,
    },
    {
      kind: 'PLANNED',
      stage: 'RESUME_QUESTIONS',
      type: 'RESUME_BASED',
      difficulty: 'MEDIUM',
      text: 'You mentioned integrating third-party REST APIs like weather and maps into client projects — what was your approach to handling loading and error states for those calls?',
      transcript:
        "I used a simple loading, error, data pattern — set a loading flag true before the fetch, catch errors into an error state, and only render the data once it resolves successfully. For the maps API specifically I also debounced the search input so we weren't firing a request on every keystroke.",
      durationSeconds: 26,
      relevance: 85,
      missingConcepts: [],
      note: 'Clear, concrete, practical pattern with a relevant extra detail (debouncing).',
      analysis: {
        correctness: 85,
        technicalDepth: 78,
        communication: 82,
        strengths: ['Clear loading/error/data state pattern', 'Proactively mentions debouncing for a search input'],
        missingConcepts: [],
        evaluationReason: 'Concrete, well-structured answer with a relevant practical detail beyond what was asked.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'BASIC_TECHNICAL',
      type: 'TECHNICAL',
      difficulty: 'HARD',
      text: 'How would you prevent unnecessary state updates in a complex React component with several child components?',
      transcript:
        "I'd start by making sure state lives as close to where it's used as possible instead of one big parent state object, use React.memo on pure child components, and useMemo or useCallback for expensive values or functions passed down as props so children don't re-render on every parent render. If it's still an issue I'd reach for the React DevTools profiler to actually see what's re-rendering before optimizing blindly.",
      durationSeconds: 30,
      relevance: 90,
      missingConcepts: [],
      note: 'Strong, layered answer — state placement, memoization, then profiling before optimizing further.',
      analysis: {
        correctness: 88,
        technicalDepth: 90,
        communication: 85,
        strengths: ['State colocation before reaching for memoization', 'Explicitly profiles before optimizing rather than guessing'],
        missingConcepts: [],
        evaluationReason: 'Comprehensive, correctly-ordered answer covering state design, memoization tools, and measurement.',
      },
      followUp: {
        text: 'Good — and if two sibling components need to share and react to the same piece of state without lifting everything to a distant common ancestor, what pattern might you reach for?',
        transcript:
          "I'd probably use Context for something like that if it's read fairly often but doesn't change constantly, or a small state manager like Zustand or Redux if updates are frequent, since Context re-renders every consumer on change.",
        durationSeconds: 20,
        relevance: 88,
        missingConcepts: [],
        note: "Correctly identifies Context's re-render tradeoff and when a dedicated store is preferable.",
        analysis: {
          correctness: 85,
          technicalDepth: 85,
          communication: 82,
          strengths: ["Understands Context's re-render cost, not just its existence"],
          missingConcepts: [],
          evaluationReason: 'Strong follow-up answer showing real understanding of the tradeoffs, not just naming a tool.',
        },
      },
    },
    {
      kind: 'CUSTOM',
      text: CUSTOM_QUESTION_TEXT,
      transcript:
        "I've heard Ravantra gives junior developers real ownership over features pretty quickly, and I want to keep growing in a product-focused React role rather than doing one-off client sites.",
      durationSeconds: 12,
      analysis: {
        correctness: 60,
        relevance: 80,
        technicalDepth: 40,
        communication: 78,
        score: 72,
        strengths: ['Specific, genuine motivation rather than generic flattery'],
        missingConcepts: [],
        evaluationReason: 'Specific and believable motivation.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'JOB_SPECIFIC',
      type: 'JOB_SPECIFIC',
      difficulty: 'HARD',
      text: 'Walk me through how you would design a dashboard screen that needs to display data from three different REST endpoints, where one of them is much slower than the others.',
      transcript:
        "I'd fetch all three in parallel with Promise.allSettled rather than sequential awaits, so the slow one doesn't block the other two. I'd render each section independently as its own data arrives, with its own loading skeleton, and show the fast sections immediately instead of waiting for everything. I'd also add a timeout and retry specifically for the slow endpoint so it doesn't hang the UI indefinitely.",
      durationSeconds: 28,
      relevance: 85,
      missingConcepts: [],
      note: 'Well-structured, practical distributed-loading design.',
      analysis: {
        correctness: 85,
        technicalDepth: 82,
        communication: 80,
        strengths: ['Parallel fetching with independent per-section rendering', 'Adds a timeout/retry specifically for the known-slow endpoint'],
        missingConcepts: [],
        evaluationReason: 'Realistic, production-minded design that avoids the naive sequential-await pitfall.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'SCENARIO',
      type: 'SCENARIO',
      difficulty: 'HARD',
      text: 'A component re-renders too often and the app feels sluggish — how would you actually go about diagnosing it, step by step?',
      transcript:
        "First I'd open the React DevTools profiler and record an interaction to see which components are re-rendering and how often. Then I'd check if it's caused by a parent passing new object or function references every render, or state that's too high up the tree. Once I know the actual cause I'd apply the right fix — memoization, moving state down, or splitting the component — rather than guessing upfront.",
      durationSeconds: 27,
      relevance: 80,
      missingConcepts: ['React 18 concurrent-rendering features (e.g. automatic batching, transitions)'],
      note: 'Correct, systematic process; doesn\'t mention newer React 18 rendering behavior.',
      analysis: {
        correctness: 82,
        technicalDepth: 78,
        communication: 80,
        strengths: ['Profiles first, diagnoses root cause, then applies a targeted fix'],
        missingConcepts: ['React 18 automatic batching / transitions'],
        evaluationReason: 'Solid systematic diagnostic process; a minor gap around newer React 18 rendering behavior.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'BEHAVIORAL',
      type: 'BEHAVIORAL',
      difficulty: 'HARD',
      text: "Tell me about a time you disagreed with a senior developer's approach — what did you do?",
      transcript:
        "A senior wanted to prop-drill some data through four component levels rather than use Context. I mentioned Context might be cleaner, but I also didn't push back hard since it was a small, unlikely-to-change part of the app — I just made a note that if it grew, Context would be worth revisiting.",
      durationSeconds: 22,
      relevance: 75,
      missingConcepts: [],
      note: 'Shows judgment about when a "better" pattern isn\'t worth a fight.',
      analysis: {
        correctness: 70,
        technicalDepth: 55,
        communication: 78,
        strengths: ['Picks technical battles proportionate to actual impact'],
        missingConcepts: [],
        evaluationReason: 'Reasonable professional judgment — raised the concern without over-escalating a low-stakes decision.',
      },
    },
    {
      kind: 'CANDIDATE_QUESTIONS',
      text: 'That covers everything on my side. Do you have any questions for us about the role or Ravantra Technologies?',
      transcript: "Yes — what does the onboarding process look like for someone's first month on the team?",
      durationSeconds: 8,
      analysis: {
        correctness: 60,
        relevance: 80,
        technicalDepth: 30,
        communication: 75,
        score: 70,
        strengths: ['Asked a genuine, engaged question back'],
        missingConcepts: [],
        evaluationReason: 'Shows genuine engagement with the process.',
      },
    },
  ],
  report: {
    overallScore: 84,
    technicalScore: 86,
    communicationScore: 80,
    strengths: [
      'Strong grasp of React performance optimization (state placement, memoization, profiling before optimizing)',
      'Designs robust, production-minded data-fetching patterns (parallel requests, per-section loading, targeted retries)',
      'Clear, structured communication with concrete, specific examples',
    ],
    areasForImprovement: [
      'Could deepen knowledge of newer React 18 concurrent-rendering features',
      'Limited exposure to TypeScript in past projects',
      'Backend/API design experience is still fairly junior',
    ],
    reasoning:
      'Ridham consistently gave detailed, technically sound answers backed by concrete reasoning — profiling before optimizing, parallelizing independent API calls, and correctly weighing Context against a dedicated state manager. Communication was clear and specific throughout, including a thoughtful behavioral answer about picking technical battles proportionately. A few areas — newer React APIs and TypeScript — would benefit from further growth, but this is a strong, hire-worthy performance for the role.',
  },
};

// ─────────────────────────────────────────────────────────────
// Candidate 3: Riya Mehta — Medium/Good
// Strong CS fundamentals (per her real resume: DBMS/OS/algorithms, top
// rank), but honest about having no hands-on React/JS experience yet —
// mixed technical performance with good general problem-solving transfer.
// ─────────────────────────────────────────────────────────────
const RIYA = {
  email: 'riya.mehta@example.com',
  firstName: 'Riya',
  screening: {
    overallScore: 45,
    skillMatchScore: 20,
    experienceMatchScore: 40,
    educationMatchScore: 95,
    matchedSkills: ['HTML'],
    missingSkills: ['React', 'JavaScript', 'CSS', 'REST API'],
    strengths: ['Excellent academic record (SPI 9.1, top-5 department rank)', 'Strong CS fundamentals (DBMS, algorithms, OS)'],
    concerns: ['No professional experience', 'No listed React/JavaScript/REST API skills on resume'],
    reasoning:
      'Weak direct skill match for this specific React role — no professional experience and no React/JavaScript listed. However, exceptionally strong academic fundamentals warrant a closer look via interview before deciding.',
  },
  resumeAlignment: {
    requiredSkillsMatched: ['HTML'],
    requiredSkillsMissing: ['React', 'JavaScript', 'CSS', 'REST API'],
    requiredSkillMatchScore: 20,
    preferredSkillsMatched: [],
    preferredSkillMatchScore: 0,
  },
  turns: [
    {
      kind: 'INTRODUCTION',
      text: introText('Riya'),
      transcript:
        "Hi, I'm Riya Mehta, I'm in my final year of B.Tech in Computer Science. I don't have professional work experience yet, but I've done a lot of coursework in databases and algorithms, and I'm really trying to break into web development now.",
      durationSeconds: 16,
    },
    {
      kind: 'PLANNED',
      stage: 'RESUME_QUESTIONS',
      type: 'RESUME_BASED',
      difficulty: 'MEDIUM',
      text: 'Your DBMS coursework project involved schema design and query optimization — can you describe one specific optimization you made and why it helped?',
      transcript:
        "Yes — I normalized a table that had repeating group data down to third normal form, and then added an index on the foreign key column we were joining on most often in our reports. That cut a slow report query from a few seconds to under a second because the database could use the index instead of scanning the whole table.",
      durationSeconds: 24,
      relevance: 85,
      missingConcepts: [],
      note: 'Concrete, correct database optimization example with a clear before/after.',
      analysis: {
        correctness: 88,
        technicalDepth: 75,
        communication: 78,
        strengths: ['Concrete before/after result (seconds to sub-second)', 'Correctly explains why the index helped (avoids full table scan)'],
        missingConcepts: [],
        evaluationReason: 'Genuine, well-explained database optimization — plays directly to her strongest area.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'BASIC_TECHNICAL',
      type: 'TECHNICAL',
      difficulty: 'HARD',
      text: 'In React, how would you prevent unnecessary state updates in a complex component tree?',
      transcript:
        "I know the concept of state in general from my coursework, but I haven't worked hands-on with React specifically, so I'm not fully sure about React's own optimization tools. I'd guess you'd want to avoid updating state more than necessary and maybe cache values, but I don't know the exact React APIs for that.",
      durationSeconds: 20,
      relevance: 40,
      missingConcepts: ['React.memo', 'useMemo/useCallback', 'component re-render triggers'],
      note: 'Honest about the specific-tool gap, but reasons toward the right general idea (avoid redundant work, cache values).',
      analysis: {
        correctness: 35,
        technicalDepth: 30,
        communication: 70,
        strengths: ['Honest and specific about what she does and doesn\'t know, rather than guessing confidently'],
        missingConcepts: ['React.memo', 'useMemo', 'useCallback'],
        evaluationReason: "Doesn't know React's specific tools, but reasons toward the right general direction (avoid unnecessary work, caching).",
      },
      followUp: {
        text: "That's alright — in general programming terms, what's one strategy you'd use to avoid redoing expensive work unnecessarily?",
        transcript:
          "Caching the result so you don't recompute it every time — like memoization, which I've seen in algorithms courses for dynamic programming problems.",
        durationSeconds: 14,
        relevance: 65,
        missingConcepts: [],
        note: 'Recovers well by transferring memoization from her DSA coursework to the general question.',
        analysis: {
          correctness: 70,
          technicalDepth: 55,
          communication: 72,
          strengths: ['Successfully transfers a general CS concept (memoization/DP) to a practical question'],
          missingConcepts: [],
          evaluationReason: "Good recovery — connects memoization from dynamic programming to general performance thinking, even without knowing React's specific hooks.",
        },
      },
    },
    {
      kind: 'CUSTOM',
      text: CUSTOM_QUESTION_TEXT,
      transcript:
        "I want to move from purely academic computer science into building real, usable products, and I liked that Ravantra seems to have an engineering-focused culture where I could actually learn from working developers.",
      durationSeconds: 13,
      analysis: {
        correctness: 55,
        relevance: 75,
        technicalDepth: 30,
        communication: 70,
        score: 68,
        strengths: ['Genuine, self-aware motivation about the academic-to-industry transition'],
        missingConcepts: [],
        evaluationReason: 'Genuine and self-aware about her transition from academia to industry.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'JOB_SPECIFIC',
      type: 'JOB_SPECIFIC',
      difficulty: 'MEDIUM',
      text: "This role involves integrating REST APIs into dashboards — what's your understanding of how a frontend typically communicates with a REST API?",
      transcript:
        "The frontend sends an HTTP request — GET to read data, POST to create data, and so on — to an endpoint, and the server responds usually in JSON, which the frontend then parses and displays. I understand this conceptually from coursework, though I haven't built the actual frontend integration myself yet.",
      durationSeconds: 19,
      relevance: 60,
      missingConcepts: ['practical fetch/error-handling experience'],
      note: 'Conceptually correct, explicitly not hands-on.',
      analysis: {
        correctness: 65,
        technicalDepth: 40,
        communication: 70,
        strengths: ['Correct conceptual model of request/response and HTTP verbs'],
        missingConcepts: ['hands-on fetch/axios usage', 'handling loading/error states in practice'],
        evaluationReason: 'Conceptually sound but self-admittedly theoretical rather than practiced.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'SCENARIO',
      type: 'SCENARIO',
      difficulty: 'MEDIUM',
      text: 'If a page felt slow to load, what general categories of causes would you consider, even without specific web-frontend experience?',
      transcript:
        "I'd think about it like any performance problem — is it network latency, is the server slow to respond, is too much data being transferred at once, or is the client spending too much time processing or rendering what it got. I'd want to actually measure each stage rather than guess which one it is.",
      durationSeconds: 22,
      relevance: 70,
      missingConcepts: [],
      note: 'Good general systems-thinking approach, appropriately measurement-first.',
      analysis: {
        correctness: 70,
        technicalDepth: 50,
        communication: 75,
        strengths: ['Structured, measurement-first troubleshooting approach transferable from general CS training'],
        missingConcepts: [],
        evaluationReason: 'Solid general problem-solving structure even without frontend-specific vocabulary.',
      },
    },
    {
      kind: 'PLANNED',
      stage: 'BEHAVIORAL',
      type: 'BEHAVIORAL',
      difficulty: 'MEDIUM',
      text: 'Tell me about a time you had to quickly pick up something completely new for a project or coursework.',
      transcript:
        "For my DBMS capstone I had to learn query optimization techniques that weren't covered in depth in lectures — I read documentation and a couple of papers on indexing strategies over about a week, then tested different approaches on our project database until I found one that actually measurably helped.",
      durationSeconds: 23,
      relevance: 78,
      missingConcepts: [],
      note: 'Concrete, self-directed learning example with a measurable outcome.',
      analysis: {
        correctness: 78,
        technicalDepth: 55,
        communication: 78,
        strengths: ['Self-directed learning backed by testing and measurement, not just reading'],
        missingConcepts: [],
        evaluationReason: 'Strong, concrete example of independent technical learning.',
      },
    },
    {
      kind: 'CANDIDATE_QUESTIONS',
      text: 'That covers everything on my side. Do you have any questions for us about the role or Ravantra Technologies?',
      transcript: "Yes — would there be mentorship available for someone moving from an academic background into a frontend-focused role?",
      durationSeconds: 9,
      analysis: {
        correctness: 60,
        relevance: 80,
        technicalDepth: 30,
        communication: 75,
        score: 70,
        strengths: ['Asks a thoughtful, self-aware question about her own growth path'],
        missingConcepts: [],
        evaluationReason: 'Thoughtful, self-aware question.',
      },
    },
  ],
  report: {
    overallScore: 64,
    technicalScore: 55,
    communicationScore: 73,
    strengths: [
      'Strong computer-science fundamentals (databases, algorithmic thinking) that transfer well to general problem-solving',
      'Honest and self-aware about current skill gaps rather than guessing confidently and incorrectly',
      'Picks up new concepts quickly — connected memoization from DSA coursework to a systems question on the fly',
    ],
    areasForImprovement: [
      'Limited hands-on experience with React-specific APIs and patterns (useMemo, useCallback, React.memo)',
      'No professional or practical experience building or shipping a frontend application yet',
      'Understanding of REST API integration is conceptual rather than hands-on',
    ],
    reasoning:
      'Riya shows excellent computer-science fundamentals and a genuinely honest, self-aware communication style, transferring general concepts — like memoization from dynamic programming — to unfamiliar territory reasonably well under a follow-up. However, she has no hands-on React or REST API integration experience yet, which is central to this role. Her performance reflects strong potential and trainable fundamentals rather than current job-readiness.',
  },
};

const CANDIDATES = [PRIYA, RIDHAM, RIYA];

async function findRequiredJob() {
  const company = await prisma.company.findFirst({ where: { user: { email: COMPANY_EMAIL } } });
  if (!company) {
    throw new Error(`Demo company (${COMPANY_EMAIL}) not found — run "npm run db:seed" first.`);
  }
  const job = await prisma.job.findFirst({ where: { companyId: company.id, title: JOB_TITLE } });
  if (!job) {
    throw new Error(`Demo job "${JOB_TITLE}" not found for ${COMPANY_EMAIL} — run "npm run db:seed" first.`);
  }
  return job;
}

async function findRequiredApplication(jobId, email) {
  const candidate = await prisma.candidate.findFirst({ where: { user: { email } } });
  if (!candidate) throw new Error(`Demo candidate (${email}) not found — run "npm run db:seed" first.`);
  const application = await prisma.application.findUnique({ where: { candidateId_jobId: { candidateId: candidate.id, jobId } } });
  if (!application) throw new Error(`Demo application for ${email} not found — run "npm run db:seed" first.`);
  return application;
}

// Wipes any previous run's demo interview data for this application so the
// script is safely re-runnable. Deleting the Interview row cascades to its
// questions/answers/events/report (onDelete: Cascade), but the InterviewSlot
// it pointed to is a separate row (Interview -> slot, not the reverse) and
// must be found and removed explicitly, or re-running this script would
// leave orphaned "BOOKED" slots behind on the Interview Scheduling page.
async function resetPriorDemoData(applicationId) {
  const priorInterviews = await prisma.interview.findMany({ where: { applicationId }, select: { slotId: true } });
  await prisma.interview.deleteMany({ where: { applicationId } });
  const priorSlotIds = priorInterviews.map((i) => i.slotId);
  if (priorSlotIds.length) await prisma.interviewSlot.deleteMany({ where: { id: { in: priorSlotIds } } });
  await prisma.screeningResult.deleteMany({ where: { applicationId } });
}

async function seedCandidateInterview(job, candidateInput, slotStart) {
  const application = await findRequiredApplication(job.id, candidateInput.email);
  await resetPriorDemoData(application.id);

  await prisma.screeningResult.create({
    data: {
      applicationId: application.id,
      status: 'COMPLETED',
      overallScore: candidateInput.screening.overallScore,
      skillMatchScore: candidateInput.screening.skillMatchScore,
      experienceMatchScore: candidateInput.screening.experienceMatchScore,
      educationMatchScore: candidateInput.screening.educationMatchScore,
      matchedSkills: candidateInput.screening.matchedSkills,
      missingSkills: candidateInput.screening.missingSkills,
      strengths: candidateInput.screening.strengths,
      concerns: candidateInput.screening.concerns,
      reasoning: candidateInput.screening.reasoning,
      aiModel: DEMO_MODEL_TAG,
      screenedAt: new Date(slotStart.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
  const slot = await prisma.interviewSlot.create({
    data: { jobId: job.id, startTime: slotStart, endTime: slotEnd, status: 'BOOKED' },
  });

  // Lay out timestamps: ~2.5 minutes apart per turn, starting at slotStart.
  let cursor = new Date(slotStart);
  const stepMs = 2.5 * 60 * 1000;
  const nextTimestamp = () => {
    const t = new Date(cursor);
    cursor = new Date(cursor.getTime() + stepMs);
    return t;
  };

  const interview = await prisma.interview.create({
    data: {
      applicationId: application.id,
      slotId: slot.id,
      status: 'COMPLETED',
      stage: 'END',
      liveKitRoomName: `interview-demo-${slot.id}`,
      plannedQuestionIndex: 0, // updated below once we know the final count
      startedAt: slotStart,
    },
  });

  const questionAnalysis = [];
  let plannedIndex = -1;
  let lastRealQuestion = null; // { id, stage, difficulty } — for follow-up inheritance

  for (const turn of candidateInput.turns) {
    let index;
    let stage;
    let type;
    let difficulty;

    if (turn.kind === 'INTRODUCTION') {
      index = 0;
      stage = 'INTRODUCTION';
      type = 'INTRODUCTION';
      difficulty = null;
    } else if (turn.kind === 'CANDIDATE_QUESTIONS') {
      plannedIndex += 1;
      index = plannedIndex;
      stage = 'CANDIDATE_QUESTIONS';
      type = 'CANDIDATE_QUESTION';
      difficulty = null;
    } else if (turn.kind === 'CUSTOM') {
      plannedIndex += 1;
      index = plannedIndex;
      stage = 'JOB_SPECIFIC';
      type = 'CUSTOM';
      difficulty = null;
    } else {
      // PLANNED
      plannedIndex += 1;
      index = plannedIndex;
      stage = turn.stage;
      type = turn.type;
      difficulty = turn.difficulty;
    }

    const askedAt = nextTimestamp();
    const question = await prisma.interviewQuestion.create({
      data: {
        interviewId: interview.id,
        index,
        stage,
        type,
        text: turn.text,
        difficulty,
        answerTimeLimitSeconds: AI_CONFIG.answerTimeSeconds,
        askedAt,
      },
    });

    const answeredAt = new Date(askedAt.getTime() + (turn.durationSeconds || 15) * 1000);
    const evaluation =
      turn.relevance != null ? { needsFollowUp: Boolean(turn.followUp), followUpQuestion: turn.followUp?.text || '', relevance: turn.relevance, missingConcepts: turn.missingConcepts || [], note: turn.note || '' } : null;

    await prisma.interviewAnswer.create({
      data: {
        questionId: question.id,
        transcript: turn.rawTranscript || turn.transcript,
        rawTranscript: turn.rawTranscript || turn.transcript,
        normalizedTranscript: turn.normalizedTranscript || turn.transcript,
        manuallyCorrected: false,
        sttConfidence: null,
        durationSeconds: turn.durationSeconds || null,
        timedOut: false,
        evaluation,
        answeredAt,
      },
    });

    if (turn.analysis) {
      questionAnalysis.push({
        questionId: question.id,
        question: turn.text,
        answerSummary: (turn.transcript || turn.normalizedTranscript || '').slice(0, 160),
        correctness: turn.analysis.correctness,
        relevance: turn.analysis.relevance ?? turn.relevance ?? 50,
        technicalDepth: turn.analysis.technicalDepth,
        communication: turn.analysis.communication,
        score: turn.analysis.score ?? Math.round((turn.analysis.correctness + turn.analysis.technicalDepth + turn.analysis.communication) / 3),
        strengths: turn.analysis.strengths || [],
        missingConcepts: turn.analysis.missingConcepts || [],
        evaluationReason: turn.analysis.evaluationReason || '',
      });
    }

    lastRealQuestion = { stage, difficulty };

    if (turn.followUp) {
      const fuAskedAt = nextTimestamp();
      const followUpQuestion = await prisma.interviewQuestion.create({
        data: {
          interviewId: interview.id,
          index, // shares parent's planned index
          stage,
          type: 'FOLLOW_UP',
          text: turn.followUp.text,
          parentQuestionId: question.id,
          difficulty, // inherited, unchanged
          answerTimeLimitSeconds: AI_CONFIG.answerTimeSeconds,
          askedAt: fuAskedAt,
        },
      });
      const fuAnsweredAt = new Date(fuAskedAt.getTime() + (turn.followUp.durationSeconds || 12) * 1000);
      await prisma.interviewAnswer.create({
        data: {
          questionId: followUpQuestion.id,
          transcript: turn.followUp.transcript,
          rawTranscript: turn.followUp.transcript,
          normalizedTranscript: turn.followUp.transcript,
          manuallyCorrected: false,
          durationSeconds: turn.followUp.durationSeconds || null,
          timedOut: false,
          evaluation: { needsFollowUp: false, followUpQuestion: '', relevance: turn.followUp.relevance, missingConcepts: turn.followUp.missingConcepts || [], note: turn.followUp.note || '' },
          answeredAt: fuAnsweredAt,
        },
      });
      if (turn.followUp.analysis) {
        questionAnalysis.push({
          questionId: followUpQuestion.id,
          question: turn.followUp.text,
          answerSummary: turn.followUp.transcript.slice(0, 160),
          correctness: turn.followUp.analysis.correctness,
          relevance: turn.followUp.analysis.relevance ?? turn.followUp.relevance,
          technicalDepth: turn.followUp.analysis.technicalDepth,
          communication: turn.followUp.analysis.communication,
          score: turn.followUp.analysis.score ?? Math.round((turn.followUp.analysis.correctness + turn.followUp.analysis.technicalDepth + turn.followUp.analysis.communication) / 3),
          strengths: turn.followUp.analysis.strengths || [],
          missingConcepts: turn.followUp.analysis.missingConcepts || [],
          evaluationReason: turn.followUp.analysis.evaluationReason || '',
        });
      }
    }
  }

  const endedAt = new Date(cursor.getTime());
  await prisma.interview.update({
    where: { id: interview.id },
    data: { plannedQuestionIndex: plannedIndex, endedAt },
  });

  await prisma.interviewReport.create({
    data: {
      interviewId: interview.id,
      status: 'COMPLETED',
      overallScore: candidateInput.report.overallScore,
      technicalScore: candidateInput.report.technicalScore,
      communicationScore: candidateInput.report.communicationScore,
      strengths: candidateInput.report.strengths,
      areasForImprovement: candidateInput.report.areasForImprovement,
      questionAnalysis,
      resumeAlignment: candidateInput.resumeAlignment,
      reasoning: candidateInput.report.reasoning,
      aiModel: DEMO_MODEL_TAG,
      generatedAt: endedAt,
    },
  });

  // Interview & security events — deliberately different per candidate.
  const events = [{ type: 'INTERVIEW_STARTED', occurredAt: slotStart }];
  if (candidateInput === PRIYA) {
    events.push(
      { type: 'CAMERA_ON', occurredAt: new Date(slotStart.getTime() + 5 * 1000) },
      { type: 'MIC_ON', occurredAt: new Date(slotStart.getTime() + 8 * 1000) },
      { type: 'CONNECTION_LOST', occurredAt: new Date(slotStart.getTime() + 6 * 60 * 1000) },
      { type: 'CONNECTION_RESTORED', occurredAt: new Date(slotStart.getTime() + 6 * 60 * 1000 + 20 * 1000) },
      { type: 'CAMERA_OFF', occurredAt: new Date(slotStart.getTime() + 11 * 60 * 1000) },
      { type: 'CAMERA_ON', occurredAt: new Date(slotStart.getTime() + 11 * 60 * 1000 + 15 * 1000) }
    );
  } else if (candidateInput === RIDHAM) {
    events.push(
      { type: 'CAMERA_ON', occurredAt: new Date(slotStart.getTime() + 4 * 1000) },
      { type: 'MIC_ON', occurredAt: new Date(slotStart.getTime() + 7 * 1000) }
    );
  } else {
    events.push(
      { type: 'CAMERA_ON', occurredAt: new Date(slotStart.getTime() + 6 * 1000) },
      { type: 'MIC_ON', occurredAt: new Date(slotStart.getTime() + 9 * 1000) },
      { type: 'TAB_SWITCH', occurredAt: new Date(slotStart.getTime() + 9 * 60 * 1000) }
    );
  }
  events.push({ type: 'INTERVIEW_ENDED', occurredAt: endedAt });

  await prisma.interviewEvent.createMany({
    data: events.map((e) => ({ interviewId: interview.id, type: e.type, occurredAt: e.occurredAt })),
  });

  await prisma.application.update({ where: { id: application.id }, data: { status: 'INTERVIEW_COMPLETED' } });

  console.log(`  + ${candidateInput.email} — interview ${interview.id} seeded (${plannedIndex + 1} planned questions + follow-ups)`);
}

async function main() {
  console.log('Seeding demo Phase 3 interview data (DEMO/SAMPLE DATA — not real interviews)...\n');

  const job = await findRequiredJob();
  console.log(`Using existing demo job: ${JOB_TITLE} (${job.id})`);

  await prisma.aiInterviewConfig.upsert({
    where: { jobId: job.id },
    create: { jobId: job.id, ...AI_CONFIG },
    update: AI_CONFIG,
  });
  console.log(`AI interviewer configured: ${AI_CONFIG.aiName} — ${AI_CONFIG.aiTitle}, ${AI_CONFIG.questionCount} questions, ${AI_CONFIG.answerTimeSeconds}s/answer, ${AI_CONFIG.voiceGender} voice\n`);

  // Interviews "took place" on 3 different past days/times for variety.
  const now = Date.now();
  const slotStarts = [
    new Date(now - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    new Date(now - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 3 days ago, +1h offset
    new Date(now - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 2 days ago, +30min offset
  ];

  for (let i = 0; i < CANDIDATES.length; i++) {
    await seedCandidateInterview(job, CANDIDATES[i], slotStarts[i]);
  }

  console.log('\nDone. 3 completed demo interviews seeded:');
  console.log('  Priya Sharma  — Very Poor  (overall 38)');
  console.log('  Ridham Patel  — Good       (overall 84)');
  console.log('  Riya Mehta    — Medium/Good (overall 64)');
  console.log('\nLog in as the demo company (company@ravantratech.demo / Demo@1234), open the');
  console.log('React.js Developer job -> Interview Scheduling, to see the completed interviews.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
