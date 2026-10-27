export const profile = {
  name: 'Kavuri Sri Eesha',
  shortName: 'Eesha',
  email: 'eesha.kavuri@gmail.com',
  location: 'Hyderabad, India',
  role: 'Software Development Engineer',
  company: 'Microsoft',
  github: 'https://github.com/EeshaKavuri',
  linkedin: 'https://www.linkedin.com/in/eesha-kavuri-902b52203/',
  resume: './Eesha_Resume_2026.pdf',
} as const;

export type ProjectCategory = 'systems' | 'ai';
export type Project = {
  id: string;
  number: string;
  name: string;
  category: ProjectCategory;
  context: string;
  subtitle: string;
  description: string;
  tags: string[];
  outcome: { value: string; label: string };
  details: { title: string; body: string }[];
};

export const projects: Project[] = [
  {
    id: 'enghub',
    number: '01',
    name: 'EngHub Get Right',
    category: 'systems',
    context: 'Microsoft / Engineering systems',
    subtitle: 'Less noise. More signal.',
    description:
      'An engineering portal built from zero, with observability and AI-assisted policy evaluation at its core.',
    tags: ['Azure Functions', '.NET 8', 'OpenTelemetry', 'Kusto'],
    outcome: { value: '<20%', label: 'false-positive rate, down from 60%' },
    details: [
      {
        title: 'The work',
        body: 'Independently architected, designed, and implemented the end-to-end telemetry pipelines and engineering portal. Built the initial web portal in under 24 hours, then took it through production readiness with scalable Azure Functions.',
      },
      {
        title: 'The engineering',
        body: 'Connected Application Insights, OpenTelemetry, and Grafana with automated Kusto Sev3 alerting. Fine-tuned policy prompts to make the results more useful and reduce false positives.',
      },
      {
        title: 'The impact',
        body: 'Reduced the false-positive rate from 60% to below 20%, with full ownership from rapid prototyping through production readiness.',
      },
    ],
  },
  {
    id: 'sketchbook',
    number: '02',
    name: 'SketchbookLM',
    category: 'ai',
    context: 'Project / Applied AI',
    subtitle: 'Give your thinking room.',
    description:
      'A visual cognitive companion that turns enterprise-grounded knowledge into one continuous visual thread.',
    tags: ['Generative AI', 'Enterprise knowledge', 'Visual canvas'],
    outcome: { value: 'One canvas.', label: 'many ways to connect knowledge' },
    details: [
      {
        title: 'The idea',
        body: 'Knowledge is rarely linear. SketchbookLM is a visual cognitive companion that brings AI and enterprise-grounded knowledge together for onboarding, documentation, and demos.',
      },
      {
        title: 'The experience',
        body: 'An AI-native canvas where distinct surfaces weave into a single, continuous visual thread, making room for the connections between ideas.',
      },
      {
        title: 'Project scope',
        body: 'An exploration of visual knowledge experiences and applied AI. The artwork on this portfolio is an original conceptual illustration, not a screenshot of the application.',
      },
    ],
  },
  {
    id: 'transfer',
    number: '03',
    name: 'File Transfer Service',
    category: 'systems',
    context: 'Microsoft / Full-stack engineering',
    subtitle: 'Big files. Small wait.',
    description:
      'End-to-end ownership of high-side file transfers, making 5 GB+ payloads move with dramatically less waiting.',
    tags: ['.NET 8', 'React 18', 'Performance'],
    outcome: { value: '75%', label: 'reduction in transfer latency' },
    details: [
      {
        title: 'The responsibility',
        body: 'Owned the high-side file transfer capability completely, from implementation to performance optimization.',
      },
      {
        title: 'The engineering',
        body: 'Built the capability end to end with .NET 8 and React 18, optimizing the handling of transfers larger than 5 GB.',
      },
      {
        title: 'The impact',
        body: 'Reduced latency by 75%, bringing transfer times down from two minutes to under 30 seconds.',
      },
    ],
  },
  {
    id: 'ainews',
    number: '04',
    name: 'AI/NEWS',
    category: 'ai',
    context: 'Project / Full-stack AI',
    subtitle: 'A little less information overload.',
    description:
      'A self-hosted AI news aggregator that finds, deduplicates, and tags the stories worth surfacing.',
    tags: ['FastAPI', 'React', 'Azure', 'Heuristic scoring'],
    outcome: { value: 'Signal > noise', label: 'a more intentional news feed' },
    details: [
      {
        title: 'The idea',
        body: 'A self-hosted, full-stack AI news aggregator for navigating a fast-moving information landscape.',
      },
      {
        title: 'The engineering',
        body: 'Combined FastAPI, React, and Azure with a custom heuristic scoring algorithm to ingest, deduplicate, and automatically tag data from multiple sources.',
      },
      {
        title: 'Project scope',
        body: 'A project focused on the pipeline from raw sources to organized information. The visual on this portfolio is an original editorial interpretation, not a live news feed.',
      },
    ],
  },
  {
    id: 'raisethebar',
    number: '05',
    name: 'RaiseTheBar',
    category: 'ai',
    context: 'Project / Developer enablement',
    subtitle: 'Keep your edge.',
    description:
      'An engineering enablement portal for sharper system design, better coding, and continuous learning in the age of AI.',
    tags: ['System design', 'Developer experience', 'Continuous learning'],
    outcome: { value: 'Always learning.', label: 'an engineering practice, not a finish line' },
    details: [
      {
        title: 'The idea',
        body: 'A one-stop engineering enablement portal to help software engineers refine system design skills and advance coding proficiency in the era of AI.',
      },
      {
        title: 'The focus',
        body: 'Continuous mastery of emerging technologies and industry best practices, with an emphasis on the craft behind the code.',
      },
      {
        title: 'Project scope',
        body: 'A developer-enablement project. The artwork is a conceptual visualization created specifically for this portfolio.',
      },
    ],
  },
];

export const experience = [
  {
    company: 'Microsoft',
    caption: 'IDEAS INTO IMPACT',
    tags: ['Cloud systems', 'Full-stack', 'Applied AI'],
    role: 'Software Development Engineer',
    period: 'Jul 2024 - Present',
    location: 'Hyderabad, India',
    description:
      'Building production-ready engineering systems across cloud, full-stack development, observability, and applied AI.',
    highlights: [
      'Owned accessibility testing for a JIT access portal serving 1,580+ engineers and approximately 11,000 bi-monthly requests.',
      'Built the centralized CARE Summary Tab, bringing interactive data, security controls, and telemetry into one destination.',
      'Investigated and remediated 30+ critical security vulnerabilities through full closure.',
    ],
  },
  {
    company: 'IBM',
    caption: 'CONNECTING TWO WORLDS',
    tags: ['Java', 'Data transformation', 'Mainframe'],
    role: 'Software Engineering Intern',
    period: 'Jan 2026 - Jun 2026',
    location: 'India',
    description:
      'Connected modern data formats with legacy mainframe architectures through a Java transformation pipeline.',
    highlights: ['Converted Avro and JSON schemas into COBOL copybooks.'],
  },
  {
    company: 'Microsoft',
    caption: 'CURIOSITY, SHIPPED',
    tags: ['Azure', 'VM extensions', 'Automation'],
    role: 'Software Development Engineer Intern',
    period: 'Apr 2023 - Jun 2023',
    location: 'Hyderabad, India',
    description:
      'Developed and shipped a SCOMMI Agent VM extension for automated agent installation and deployment in the Azure Portal.',
    highlights: [],
  },
] as const;

export const capabilities = [
  {
    number: '01',
    title: 'Full-stack, end to end.',
    description: 'From the first interaction to the API behind it.',
    skills: ['React', 'TypeScript', '.NET', 'C#', 'FastAPI', 'Java'],
  },
  {
    number: '02',
    title: 'Cloud, with confidence.',
    description: 'Systems built to ship, scale, and be understood.',
    skills: ['Azure', 'Cosmos DB', 'Bicep', 'OpenTelemetry', 'Grafana', 'Kusto'],
  },
  {
    number: '03',
    title: 'AI, with intention.',
    description: 'Useful intelligence, grounded in real knowledge.',
    skills: ['Azure OpenAI', 'Semantic Kernel', 'RAG', 'AI agents', 'PyTorch', 'Vector DBs'],
  },
] as const;
