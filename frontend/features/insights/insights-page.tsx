"use client";

import {
  ArrowRight,
  Brain,
  ClockClockwise,
  MoonStars,
  TrendUp,
  Warning,
} from "@phosphor-icons/react";
import { Badge, Card, EmptyState, LoadingState, SectionHeader } from "@/components/common/ui";
import { useApp } from "@/components/common/app-provider";

import { courseToneClass } from "@/lib/course-style";
import { selectStudyTimeBySubject } from "@/lib/selectors";

export function InsightsPage() {
  const {
    backendMode,
    loading,
    assignments,
    courses,
    insights: insightMetrics,
    workload: weeklyWorkload,
  } = useApp();
  if (loading) return <LoadingState label="Loading insights" />;
  if (!assignments.length || !courses.length) {
    return (
      <EmptyState title="No insights yet" body="Insights appear when assignments are available." />
    );
  }
  const subjectTotals = selectStudyTimeBySubject(assignments);
  const maxTotal = Math.max(...Object.values(subjectTotals));
  const estimates = assignments.filter((item) => item.actualMinutes).slice(0, 4);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Insights</h1>
          <p>
            Student-focused patterns from four weeks of clearly labeled{" "}
            {backendMode ? "deterministic starter history" : "demo history"}.
          </p>
        </div>
        <Badge tone="warning">{backendMode ? "STARTER DATA" : "DEMO DATA"} · 4 WEEKS</Badge>
      </div>
      <div className="insight-lede">
        <Card className="insight-story">
          <div className="eyebrow">This week’s story</div>
          <blockquote>
            Shorter weekday sessions are working. Sunday is still carrying too much writing.
          </blockquote>
          <p>
            You completed 82% of work before its deadline and missed only two sessions. Both misses
            followed rowing, while Sunday’s planned workload exceeded capacity by 45 minutes. Canvai
            may add recovery space after training and start essays earlier.
          </p>
        </Card>
        <Card className="week-score">
          <div className="score-ring">
            <span>86%</span>
          </div>
          <strong>Weekly consistency</strong>
          <small>6 points above last week</small>
        </Card>
      </div>
      <div className="insight-metrics">
        {insightMetrics.map((metric) => (
          <Card className="insight-metric" key={metric.id}>
            <span>{metric.label}</span>
            <h3>{metric.value}</h3>
            <small>{metric.change}</small>
            <p>
              <strong>What happened:</strong> {metric.explanation}
            </p>
            <footer>
              <strong>Canvai may adjust:</strong> {metric.adjustment}
            </footer>
          </Card>
        ))}
      </div>
      <div className="editorial-grid">
        <Card>
          <SectionHeader
            title="Study time by course"
            aside={
              <span className="muted" style={{ fontSize: 11 }}>
                Minutes · estimated from {backendMode ? "starter history" : "demo history"}
              </span>
            }
          />
          <div className="course-bars">
            {courses.map((course) => {
              const value = subjectTotals[course.id] ?? 0;
              return (
                <div key={course.id}>
                  <div className="course-bar-top">
                    <span className={courseToneClass(course.id)}>{course.name}</span>
                    <strong>{value}m</strong>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${courseToneClass(course.id)}`}
                      style={{ width: `${(value / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <SectionHeader
            title="Estimated versus actual"
            aside={
              <span className="muted" style={{ fontSize: 11 }}>
                Gray: estimate · blue: actual
              </span>
            }
          />
          <div className="estimate-chart">
            {estimates.map((assignment) => {
              const max = Math.max(assignment.estimatedMinutes, assignment.actualMinutes ?? 0);
              return (
                <div className="estimate-row" key={assignment.id}>
                  <span>
                    {courses.find((course) => course.id === assignment.courseId)?.shortName}
                  </span>
                  <div className="estimate-track">
                    <i
                      className="estimate-planned"
                      style={{ width: `${(assignment.estimatedMinutes / max) * 100}%` }}
                    />
                    <i
                      className="estimate-actual"
                      style={{ width: `${((assignment.actualMinutes ?? 0) / max) * 100}%` }}
                    />
                  </div>
                  <strong>{assignment.actualMinutes}m</strong>
                </div>
              );
            })}
            <div className="canvai-callout" style={{ marginTop: 18 }}>
              <Brain />
              <span>
                Actual reading and worksheet times are 12% below estimates. Canvai may cautiously
                shorten similar work.
              </span>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <SectionHeader
          title="Deadline pressure"
          aside={<Badge tone="danger">Sunday overloaded</Badge>}
        />
        <div className="workload-chart" style={{ padding: "4px 19px 19px" }}>
          {weeklyWorkload.map((day, index) => (
            <div className="workload-day" key={day.day}>
              <strong>{day.deadlinePressure}</strong>
              <div className={`workload-track ${index === 2 ? "today" : ""}`}>
                <i
                  className={`workload-bar ${day.deadlinePressure > 85 ? "over" : ""}`}
                  style={{ height: `${day.deadlinePressure}%` }}
                />
              </div>
              <span className={index === 2 ? "today" : ""}>
                {day.day}
                {day.tests ? " · Test" : day.writingHeavy ? " · Writing" : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <div className="trend-list">
        <Card className="trend-card">
          <ClockClockwise />
          <h3>Rescheduled sessions</h3>
          <p>
            Three sessions moved; two changes followed rowing and one protected a family dinner.
          </p>
          <footer>
            Why it matters <ArrowRight /> recovery buffers can reduce repeat moves.
          </footer>
        </Card>
        <Card className="trend-card">
          <MoonStars />
          <h3>Sunday workload & sleep</h3>
          <p>Sunday reached 3 hours, but six of seven nights still kept the sleep guardrail.</p>
          <footer>Canvai may move 50 minutes of English to Saturday.</footer>
        </Card>
        <Card className="trend-card">
          <TrendUp />
          <h3>Subject difficulty trend</h3>
          <p>Physics remains hardest at 4.6/5. AP Seminar estimates are becoming more accurate.</p>
          <footer>Tests keep extra priority; essay buffers can shrink gradually.</footer>
        </Card>
      </div>
      <div className="warning-callout">
        <Warning weight="fill" />
        <span>
          <strong>Interpret {backendMode ? "starter" : "demo"} insights carefully.</strong>{" "}
          {backendMode
            ? "These deterministic examples are fictional account data, not Canvas or provider history."
            : "These patterns are fictional and never leave this browser. Real learning begins only after future integrations are authorized."}
        </span>
      </div>
    </div>
  );
}
