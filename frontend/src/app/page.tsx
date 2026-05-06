"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const features = [
    {
      title: "Natural Language Processing",
      desc: "Our AI doesn't just read text; it understands context. It identifies mentions, estimates effort, and detects roadblocks automatically from your daily updates.",
      icon: "🧠"
    },
    {
      title: "Bi-Directional Sync",
      desc: "Changes in the dashboard reflect back to your team. Mention a user in a comment, and they'll receive a notification directly in their Teams chat.",
      icon: "🔄"
    },
    {
      title: "Predictive Analytics",
      desc: "Agile Copilot analyzes your team's historical velocity to predict sprint completion dates and warn you about potential delays before they happen.",
      icon: "📈"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased selection:bg-purple-100 selection:text-purple-900">
      {/* Ultra-Slim Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-sm">
              <span className="text-[10px]">⚡</span>
            </div>
            <span className="text-[14px] font-bold tracking-tight">Agile Copilot</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-6">
              {["Solution", "Workflow", "Roles", "FAQ"].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} className="text-[11px] font-semibold text-gray-500 hover:text-purple-600 transition-colors">{item}</a>
              ))}
            </div>
            <div className="h-4 w-px bg-gray-200 hidden md:block" />
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-[11px] font-bold text-gray-600 hover:text-purple-600">Login</Link>
              <Link href="/login" className="px-3 py-1 rounded-md bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-800 transition-all">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-24 pb-16 px-6 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 text-left">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 text-[9px] font-bold text-purple-600 uppercase tracking-widest mb-4">
            New: Teams Integration 2.0
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-[1.1] mb-4">
            The AI engine that <br className="hidden lg:block" />
            powers your <span className="text-purple-600">Agile velocity.</span>
          </h1>
          <p className="text-[14px] text-gray-500 max-w-md leading-relaxed mb-8">
            Transform messy chat updates into actionable sprint data. Agile Copilot
            automates the tedious parts of project management so your team can
            stay focused on what they do best: writing code.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-5 py-2 rounded-lg bg-purple-600 text-white font-bold text-[12px] shadow-sm hover:bg-purple-700 transition-all">
              Get Started for Free
            </Link>
            <button className="px-5 py-2 rounded-lg border border-gray-200 text-gray-700 font-bold text-[12px] hover:bg-gray-50">
              Watch Product Tour
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
          <div className="absolute -inset-4 bg-purple-50 rounded-3xl -z-10 blur-xl" />
          <div className="rounded-xl border border-gray-100 shadow-2xl overflow-hidden bg-white group cursor-pointer transition-transform hover:scale-[1.01]">
            <img src="/images/dashboard.png" alt="Dashboard" className="w-full h-auto" />
          </div>
        </div>
      </header>

      {/* Interactive Tabs Section - Providing Context */}
      <section id="solution" className="py-16 bg-gray-50/50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-[22px] font-black mb-2">Beyond Simple Tracking</h2>
            <p className="text-[13px] text-gray-500">Agile Copilot is built specifically for modern developer workflows.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full md:w-64 flex flex-col gap-1">
              {features.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`text-left px-4 py-3 rounded-lg text-[12px] font-bold transition-all ${activeTab === i ? 'bg-white border border-gray-100 shadow-sm text-purple-600' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {f.title}
                </button>
              ))}
            </div>
            <div className="flex-1 p-8 rounded-2xl bg-white border border-gray-100 shadow-sm min-h-[160px]">
              <div className="text-2xl mb-4">{features[activeTab].icon}</div>
              <h3 className="text-[15px] font-black mb-3">{features[activeTab].title}</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed max-w-2xl">{features[activeTab].desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-16 px-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 relative max-w-md">
            <div className="absolute inset-0 bg-fuchsia-100/50 blur-[60px] -z-10" />
            <div className="rounded-xl border-4 border-white shadow-xl overflow-hidden">
              <img src="/images/teams.png" alt="Teams Integration" className="w-full h-auto" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-[22px] font-black mb-6">Built for Microsoft Teams</h2>
            <div className="space-y-6">
              {[
                { step: "01", title: "Smart Webhooks", desc: "Our system listens to specific channel activity via secure Graph API subscriptions." },
                { step: "02", title: "Contextual Parsing", desc: "The AI identifies project keywords, mentions, and status updates within natural sentences." },
                { step: "03", title: "Live Sync", desc: "Dashboards reflect changes within 2 seconds of the message being sent." }
              ].map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[11px]">{s.step}</div>
                  <div>
                    <h4 className="text-[13px] font-black text-gray-900 mb-0.5">{s.title}</h4>
                    <p className="text-[12px] text-gray-500 leading-relaxed max-w-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Role Management */}
      <section id="roles" className="py-16 px-6 max-w-6xl mx-auto border-t border-gray-100">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col gap-5 hover:border-purple-200 transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center text-lg">👑</div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global</span>
            </div>
            <div>
              <h3 className="text-sm font-black mb-2">Super Admin</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-4">Enterprise-wide visibility. Audit every workspace, monitor overall delivery health, and manage system-level integrations.</p>
              <div className="flex flex-wrap gap-2">
                {["System Audit", "SLA Monitoring", "License Mgmt"].map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded bg-gray-50 text-[9px] font-bold text-gray-500">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white border-2 border-purple-100 shadow-lg shadow-purple-500/5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center text-lg">💼</div>
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Workspace</span>
            </div>
            <div>
              <h3 className="text-sm font-black mb-2">Workspace Manager</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-4">Full team control. Manage sprint backlogs, approve task promotion, and monitor individual developer velocity.</p>
              <div className="flex flex-wrap gap-2">
                {["Member Sync", "Backlog Triage", "Burndown Charts"].map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded bg-purple-50 text-[9px] font-bold text-purple-600">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col gap-5 hover:border-purple-200 transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center text-lg">⚡</div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Execution</span>
            </div>
            <div>
              <h3 className="text-sm font-black mb-2">Team Member</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-4">Native developer experience. Post updates in chat, see your personal progress dashboard, and focus on coding.</p>
              <div className="flex flex-wrap gap-2">
                {["Chatbot Sync", "Personal Goals", "Task History"].map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded bg-gray-50 text-[9px] font-bold text-gray-500">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact & Detailed Metrics */}
      <section className="py-16 bg-gray-900 text-white px-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px]" />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div className="flex-1">
            <h2 className="text-[22px] font-black mb-6">Measurable improvement.</h2>
            <div className="space-y-6">
              {[
                { t: "Automated Data Collection", d: "Eliminate the 15-minute daily 'update Jira' tax for every developer." },
                { t: "Real-time Blocker Alerts", d: "Instantly notify managers when a blocker is detected in a chat message." },
                { t: "Data-Driven Standups", d: "Use live velocity charts instead of memory-based verbal updates." }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-white mb-1">{item.t}</h4>
                    <p className="text-[12px] text-gray-400 leading-relaxed">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            {[
              { title: "40%", desc: "Standup Time Reduction" },
              { title: "2x", desc: "Task Visibility Increase" },
              { title: "100%", desc: "Data Entry Automation" },
              { title: "0", desc: "Training Required" },
            ].map(stat => (
              <div key={stat.desc} className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-[20px] font-black mb-1">{stat.title}</div>
                <div className="text-[11px] text-gray-400">{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion - Interactive */}
      <section id="faq" className="py-20 px-6 max-w-3xl mx-auto">
        <h2 className="text-[22px] font-black text-center mb-10">Frequently Asked</h2>
        <div className="space-y-3">
          {[
            { q: "How does the Microsoft Teams integration work?", a: "We use Microsoft Graph API webhooks to securely listen to messages in your authorized channels. Our AI only processes messages that follow the EOD/Task format or mentions our bot." },
            { q: "Can we self-host Agile Copilot?", a: "Currently, we offer a secure Cloud-based solution. Enterprise self-hosting options are on our roadmap for late 2026." },
            { q: "Is the AI accuracy guaranteed?", a: "Our models have a 99.8% accuracy rate for standard English task descriptions. We always provide a 'review' state for tasks that are ambiguous." },
            { q: "What happens to my data?", a: "Data is encrypted at rest and in transit. We are SOC2 Type II compliant and never sell your team's internal data." }
          ].map((f, i) => (
            <div key={i} className="group p-4 rounded-xl border border-gray-100 bg-white hover:border-purple-200 transition-colors cursor-pointer">
              <div className="text-[12px] font-bold text-gray-900 mb-1 flex justify-between items-center">
                {f.q}
                <span className="text-gray-300 group-hover:text-purple-400">+</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed hidden group-hover:block pt-2 border-t border-gray-50 mt-2">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚡ Agile Copilot</span>
            <span className="text-gray-400">© 2026 World Goods Market</span>
          </div>
          <div className="flex gap-8 text-gray-500 font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-purple-600">Privacy</a>
            <a href="#" className="hover:text-purple-600">Terms</a>
            <a href="#" className="hover:text-purple-600">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
