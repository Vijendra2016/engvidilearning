import Link from "next/link";

const tools = [
  {
    href: "/voice",
    title: "Voice Recorder",
    label: "mic",
    description:
      "Record yourself speaking and see your words transcribed in real time. Practice pronunciation, storytelling, or daily conversation.",
  },
  {
    href: "/camera",
    title: "Self Video",
    label: "camera",
    description:
      "Record yourself on camera to review your body language and expressions. Get a transcript you can paste into an AI tool for English feedback.",
  },
  {
    href: "/screen",
    title: "Screen Recorder",
    label: "screen",
    description:
      "Capture your screen to record presentations or explanations. Watch yourself back and improve your English delivery.",
  },
  {
    href: "/teleprompter",
    title: "Teleprompter",
    label: "script",
    description:
      "Paste a script and read it aloud with auto-scroll. Perfect for practicing speeches, news reading, or storytelling.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <div className="pt-8 space-y-4">
        <h1 className="text-4xl font-bold tracking-tight leading-tight">
          Practice English,
          <br />
          your way.
        </h1>
        <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
          Three simple tools to help you speak, record, and improve every day.
          Everything runs in your browser — nothing is uploaded.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
          >
            <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3">
              {tool.label}
            </span>
            <h2 className="text-lg font-semibold mb-2">{tool.title}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed flex-1">
              {tool.description}
            </p>
            <span className="mt-6 text-sm text-zinc-600 group-hover:text-zinc-300 transition-colors">
              Open &rarr;
            </span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-zinc-700">
        Works best in Chrome or Edge. Firefox supports recording but not live transcription.
      </p>
    </div>
  );
}
