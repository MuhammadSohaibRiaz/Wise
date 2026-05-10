// SEO-optimized enterprise software development services for Plasmocode
// Local images from /public/images/ where available; Unsplash for the rest.

const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=720&h=480&fit=crop`;

export const SERVICES_LIST = [
  {
    name: "Enterprise Software Development & Modernization",
    tags: ["Custom Software", "Legacy Modernization", "ERP & CRM Systems", "Microservices", "SaaS Platforms"],
    img: U("1498050108023-c5249f4df085"),
    url: "#enterprise-software",
    description:
      "Transform your business with scalable enterprise software solutions. Plasmocode builds custom applications, modernizes legacy systems, and develops multi-tenant SaaS platforms that reduce operational costs and accelerate growth. From ERP integrations to customer portals, we deliver high-availability systems that scale with your business.",
  },
  {
    name: "Cloud Infrastructure & DevOps Automation",
    tags: ["AWS & Azure", "CI/CD Pipelines", "Kubernetes", "Infrastructure as Code", "24/7 Monitoring"],
    img: U("1544197150-b99a580bb7a8"),
    url: "#cloud-devops",
    description:
      "Accelerate deployment with automated DevOps pipelines and cloud-native infrastructure. We design resilient cloud architectures (AWS, Azure, GCP), implement container orchestration, and provide SRE support. Reduce downtime, optimize infrastructure costs, and achieve high availability with proven DevOps practices.",
  },
  {
    name: "Mobile Apps (iOS & Android)",
    tags: ["React Native", "Flutter", "Native iOS/Android", "Cross-Platform", "App Store"],
    img: "/images/mobile-apps.jpg",
    url: "#mobile-apps",
    description:
      "Ship polished mobile apps for iOS and Android with one codebase or native builds. We use React Native and Flutter for cross-platform apps, or go native when you need maximum performance. From MVP to App Store and Play Store launch, we handle design, development, and deployment.",
  },
  {
    name: "AI & Data Analytics Solutions",
    tags: ["Machine Learning", "Predictive Analytics", "Business Intelligence", "Data Warehousing", "MLOps", "n8n"],
    img: U("1551288049-bebda4e38f71"),
    url: "#ai-data-analytics",
    description:
      "Unlock data-driven insights and automate processes with AI-powered solutions. Plasmocode develops custom ML models, real-time analytics dashboards, and enterprise data platforms. From predictive forecasting to intelligent automation, we turn your data into a competitive advantage.",
  },
  {
    name: "Custom ML Models & AI Engineering",
    tags: ["Computer Vision", "NLP", "Recommendation Engines", "Model Training", "MLOps"],
    img: "/images/ML.jpg",
    url: "#ml-models",
    description:
      "Build and deploy custom machine learning models tailored to your data and use case. We design, train, and integrate ML solutions—from computer vision and NLP to recommendation systems and forecasting—with robust MLOps so your models stay accurate and scalable in production.",
  },
  {
    name: "Chatbot & Conversational AI Integration",
    tags: ["Customer Support Bots", "Live Chat Integration", "LLM-Powered Assistants", "Website & App Chat", "Multi-Channel"],
    img: "/images/chatgpt.jpg",
    url: "#chatbot-ai",
    description:
      "Engage customers 24/7 with intelligent chatbots and conversational AI. We build and integrate custom chatbots for websites, apps, and messaging platforms—powered by LLMs for natural, helpful conversations. Perfect for support, lead capture, and automated workflows.",
  },
  {
    name: "Voice Agents & Speech AI",
    tags: ["Voice Assistants", "IVR & Call Automation", "Speech-to-Text", "Text-to-Speech", "Voice UX"],
    img: "/images/voice-ai.jpg",
    url: "#voice-agents",
    description:
      "Bring voice-first experiences to your product with custom voice agents and speech AI. From IVR and call-center automation to in-app voice assistants and accessibility features, we implement speech recognition, synthesis, and natural dialogue so users can interact by voice.",
  },
  {
    name: "Managed Reseller Hosting",
    tags: ["White-Label Hosting", "cPanel / Plesk", "VPS & Dedicated", "SSL & Security", "24/7 Managed"],
    img: "/images/reseller-hosting.jpg",
    url: "#reseller-hosting",
    description:
      "Full-fledged managed reseller hosting so you can offer hosting under your own brand. We set up and manage white-label infrastructure, control panels, SSL, backups, and monitoring—so you can focus on selling and supporting your clients with reliable, scalable hosting.",
  },
  {
    name: "Canva-like Design & Creative Apps",
    tags: ["Drag-and-Drop Editor", "Templates & Assets", "Brand Kits", "Export & Publish", "Collaboration"],
    img: "/images/canva.jpg",
    url: "#designer-app",
    description:
      "Build a Canva-like design platform for your users: drag-and-drop canvas, templates, brand kits, and export to web or print. We deliver scalable design tools—from simple graphic editors to full creative suites—so startups and SMBs can offer professional design without the complexity.",
  },
  {
    name: "Quality Assurance & Test Automation",
    tags: ["Automated Testing", "Performance Testing", "CI/CD Integration", "Security Testing", "QA Strategy"],
    img: "/images/testing.jpg",
    url: "#qa-testing",
    description:
      "Deliver reliable software with enterprise-grade QA and test automation. We implement unit, integration, E2E, and performance testing. Our automated QA pipelines integrate with CI/CD workflows, ensuring faster releases and fewer production issues.",
  },
];
