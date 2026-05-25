**Voice AI Observability Copilot** 

**Objective** 

Design and implement an **Agent Observability Copilot** that automates the **"Monitor"** and **"Analyze"** phases for HighLevel Voice AI agents. The goal is to move beyond manual log review by using AI to autonomously track call performance against metrics and provide immediate, actionable recommendations. 

**The Challenge** 

Current Voice AI setups require significant manual effort to audit call transcripts and ensure agents are meeting success criteria. You will build a tool that acts as a **"Validation Flywheel,"** providing a real-time observability layer that ensures agents are performing optimally through automated analysis. 

**Requirements** 

**1\. Setup & Integration** 

● Use a sandbox account from the HighLevel Marketplace. 

● Integrate your solution into the HighLevel interface using **custom JS or a GHL marketplace app** that allows your code to reside within the customer account. 

**2\. Core Functionality** Your Copilot must handle two primary observability loops: 

● **Monitor (Observability):** 

○ Ingest and analyze existing Voice AI agent call transcripts. 

○ Set observability parameters based on the agent's specific goals or script. ○ Identify deviations, failures, or missed opportunities against success criteria (KPIs) in the logs. 

● **Analyze (Unified Dashboard):** 

○ Build an intuitive dashboard that visualizes performance issues across existing agents. 

○ Provide **immediate recommendations** for prompt/script/agent adjustments based on identified failures. 

○ Highlight "Use Actions" (e.g., specific segments of a call that require human intervention or script training). 

**Deliverables** 

**1\. Code & Implementation** 

● Github repo URL for the widget/marketplace app and backend logic (Node.js backend, Vue.js frontend).  
● Documented steps to install and run the observability suite inside a HighLevel sandbox. **2\. Demo (2-5 Minutes)** 

● **Workflow:** Show the Copilot ingesting and monitoring Voice AI transcripts: ○ **Dashboard:** Demonstrate the unified view of issues and metrics. 

○ **Insight:** Show the AI-generated recommendations for a specific agent based on its call history. 

● **Artist:** Recommended to use tools like Loom to capture yourself while recording the demo 

**3\. Documentation** 

● A brief README describing your architecture and how you handled **"Team of One"** ownership (Product, Design, Engineering & QA). 

● Notes on what is functional (real-time transcript ingestion) vs. what is mocked. 

**Evaluation Criteria** 

● **Product Thinking \+ UI/UX:** Is the dashboard customer-centric, intuitive, and seamlessly integrated into HighLevel? 

● **Completeness:** Does the system successfully close the loop from raw logs to actionable recommendations? 

● **Technical Integrity:** Clarity of your observability architecture and recommendations logic. 

● **Manual Code Review:** We urge only non-slop code to be submitted after a thorough manual review.