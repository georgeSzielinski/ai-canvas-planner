"use client";

import { FormEvent, useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  CalendarCheck,
  Check,
  ClockClockwise,
  MoonStars,
  PencilSimple,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { useApp } from "@/components/common/app-provider";
import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/common/ui";
import { supportedCanvaiCommands } from "@/services/canvai-service";
import { services } from "@/services";

const activity = [
  ["Moved Physics preparation", "Made room after rowing ran late", "2h"],
  ["Protected Sunday evening", "Moved 50 minutes of writing to Saturday", "Yesterday"],
  ["Updated English estimate", "Used your last three essay completions", "Mon"],
  ["Rebuilt the week", "Balanced 11 sessions across free time", "Sun"],
];

export function CanvaiPage() {
  const { backendMode, proposal, setProposal, applyProposal, appliedCommands, showToast } =
    useApp();
  const [processing, setProcessing] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [answered, setAnswered] = useState(false);

  const runCommand = async (command: string) => {
    if (!command.trim()) return;
    setProcessing(true);
    setProposal(null);
    setEditing(false);
    try {
      setProposal(await services.canvai.proposeScheduleChange(command.trim()));
    } catch {
      showToast("Canvai could not create a proposal.");
    } finally {
      setProcessing(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const command = input;
    setInput("");
    void runCommand(command);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Canvai</h1>
          <p>
            A planning control center for briefings, tradeoffs, and schedule changes — not a generic
            chatbot.
          </p>
        </div>
        <Badge tone="success">● Ready · {backendMode ? "account data" : "local demo"}</Badge>
      </div>
      <div className="canvai-hero">
        <Card className="briefing-card">
          <div className="briefing-brand">
            <span className="canvai-mark">
              <Sparkle weight="fill" />
            </span>
            <div>
              <h2>Good afternoon, Maya.</h2>
              <p>Daily briefing · Wednesday, September 16</p>
            </div>
          </div>
          <p className="briefing-copy">
            Tonight is focused but manageable. Finish the short missing reflection first, then
            protect two calm blocks for AP Seminar and Physics.
          </p>
          <div className="briefing-points">
            <div className="briefing-point">
              <small>Today</small>
              <strong>2 planned sessions</strong>
            </div>
            <div className="briefing-point">
              <small>This week</small>
              <strong>Sunday needs relief</strong>
            </div>
            <div className="briefing-point">
              <small>Guardrail</small>
              <strong>Sleep by 10:30 PM</strong>
            </div>
          </div>
        </Card>
        <Card className="question-card">
          <div className="spread">
            <h2>Canvai needs your input</h2>
            <Badge tone="warning">1 question</Badge>
          </div>
          {answered ? (
            <div style={{ paddingTop: 26 }}>
              <Badge tone="success">
                <Check /> Answer saved
              </Badge>
              <p>I’ll keep Friday night light when future plans are rebuilt.</p>
              <Button onClick={() => setAnswered(false)}>Change answer</Button>
            </div>
          ) : (
            <>
              <p>Your English deadline moved. How much work is realistic on Friday night?</p>
              <div className="question-options">
                {[
                  "None — protect the evening",
                  "One light 30-minute block",
                  "Normal study availability",
                ].map((answer) => (
                  <button
                    onClick={() => {
                      setAnswered(true);
                      showToast(`${answer} saved locally`);
                    }}
                    key={answer}
                  >
                    {answer}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
      <Card>
        <SectionHeader
          title="Suggested planning commands"
          eyebrow="One-tap changes"
          aside={
            <span className="muted" style={{ fontSize: 11.5 }}>
              Preview required before apply
            </span>
          }
        />
        <div className="command-grid">
          {supportedCanvaiCommands.map((command) => (
            <button className="command-button" key={command} onClick={() => runCommand(command)}>
              <Sparkle />
              <span>{command}</span>
            </button>
          ))}
        </div>
        <form className="canvai-input" onSubmit={submit}>
          <label className="sr-only" htmlFor="canvai-command">
            Ask Canvai to adjust your plan
          </label>
          <input
            id="canvai-command"
            className="text-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Canvai to adjust your plan…"
          />
          <Button variant="primary" type="submit" aria-label="Send command">
            <ArrowRight />
          </Button>
        </form>
      </Card>
      <div className="canvai-workspace">
        <Card className="proposal-card">
          <SectionHeader
            title="Schedule-change preview"
            eyebrow="Canvai workspace"
            aside={
              proposal && (
                <Badge tone={proposal.status === "applied" ? "success" : "accent"}>
                  {proposal.status}
                </Badge>
              )
            }
          />
          {processing ? (
            <div className="proposal-processing" role="status">
              <span className="analysis-orbit">
                <Sparkle />
              </span>
              <strong>Canvai is analyzing deadlines and free time…</strong>
              <span>Keeping school, rowing, meals, and sleep fixed.</span>
            </div>
          ) : proposal ? (
            <>
              <div className="proposal-body">
                <h2 style={{ marginTop: 0, fontSize: 17 }}>
                  {editing ? (
                    <input
                      className="text-input"
                      aria-label="Edit proposal summary"
                      value={editedSummary}
                      onChange={(event) => setEditedSummary(event.target.value)}
                    />
                  ) : (
                    editedSummary || proposal.summary
                  )}
                </h2>
                <p>{proposal.reasoning}</p>
                <div className="proposal-reason canvai-callout">
                  <Sparkle weight="fill" />
                  <span>
                    These are local deterministic changes. No calendar events or AI services are
                    contacted.
                  </span>
                </div>
                <div style={{ marginTop: 12 }}>
                  {proposal.changes.map((change) => (
                    <div className="proposal-change" key={change.id}>
                      <span>{change.kind === "protect" ? <MoonStars /> : <ClockClockwise />}</span>
                      <div>
                        <h3>{change.label}</h3>
                        <p>
                          {change.before && (
                            <>
                              {change.before}{" "}
                              <ArrowRight style={{ width: 11, verticalAlign: "-2px" }} />{" "}
                            </>
                          )}
                          {change.after}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="proposal-actions">
                <Button
                  icon={editing ? <Check /> : <PencilSimple />}
                  onClick={() => {
                    if (!editing) setEditedSummary(editedSummary || proposal.summary);
                    setEditing(!editing);
                  }}
                >
                  {editing ? "Done editing" : "Edit"}
                </Button>
                <Button
                  icon={<X />}
                  onClick={() => {
                    setProposal(null);
                    showToast("Proposal dismissed — no schedule changed");
                  }}
                >
                  Dismiss
                </Button>
                <Button
                  variant="primary"
                  icon={<CalendarCheck />}
                  disabled={backendMode || proposal.status === "applied"}
                  onClick={applyProposal}
                >
                  {backendMode
                    ? "Preview only in Phase 2"
                    : proposal.status === "applied"
                      ? "Applied"
                      : "Apply changes"}
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Choose a planning action"
              body={`Canvai will analyze the ${backendMode ? "account plan" : "local demo plan"} and show proposed changes here before anything is applied.`}
            />
          )}
        </Card>
        <div className="stack">
          <Card>
            <SectionHeader
              title="Planning activity"
              aside={<Badge>{backendMode ? "Starter history" : "Demo history"}</Badge>}
            />
            <div className="activity-list">
              {appliedCommands.map((command) => (
                <div className="activity-item" key={`applied-${command}`}>
                  <span>
                    <Check />
                  </span>
                  <div>
                    <strong>{command}</strong>
                    <p>Applied in this local session</p>
                  </div>
                  <time>Now</time>
                </div>
              ))}
              {activity.map(([title, body, time]) => (
                <div className="activity-item" key={title}>
                  <span>
                    <ArrowClockwise />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                  <time>{time}</time>
                </div>
              ))}
            </div>
          </Card>
          <Card className="card-padded">
            <div className="eyebrow">Weekly briefing</div>
            <h2 style={{ fontSize: 16, margin: 0 }}>The week is 86% balanced.</h2>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Deadline pressure peaks Thursday and Sunday. Canvai recommends starting English
              earlier and leaving a buffer after rowing.
            </p>
            <Button onClick={() => runCommand("Rebuild the week")} icon={<ArrowClockwise />}>
              Preview a full rebuild
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
