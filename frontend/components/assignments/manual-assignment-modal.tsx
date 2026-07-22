"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { courses } from "@/lib/demo-data";
import { useApp } from "@/components/common/app-provider";
import { Button, Modal } from "@/components/common/ui";
import type { Assignment, AssignmentType, Priority } from "@/types/domain";

const schema = z.object({
  title: z.string().min(3, "Enter at least 3 characters"),
  courseId: z.string().min(1),
  type: z.enum(["essay", "homework", "test", "presentation", "reading", "project"]),
  dueAt: z.string().min(1, "Choose a due date"),
  estimatedMinutes: z.number().min(10).max(600),
  points: z.number().min(0).max(1000),
});
type FormValues = z.infer<typeof schema>;

export function ManualAssignmentModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const { addAssignment } = useApp();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { courseId: courses[0].id, type: "homework", estimatedMinutes: 45, points: 20 },
  });
  const submit = (values: FormValues) => {
    const priority: Priority = values.type === "test" ? "high" : "medium";
    const assignment: Assignment = {
      id: `manual-${values.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      courseId: values.courseId,
      title: values.title,
      description: "Manually added in the Phase 1 demo.",
      type: values.type as AssignmentType,
      dueAt: new Date(values.dueAt).toISOString(),
      points: values.points,
      estimatedMinutes: values.estimatedMinutes,
      priority,
      submissionStatus: "not_started",
      missing: false,
      completionState: "open",
      scheduledSessionIds: [],
      canvasUrl: "https://canvas.example.test/manual",
      analysis: {
        difficulty: 3,
        urgency: 3,
        priorityScore: priority === "high" ? 76 : 58,
        explanation:
          "Canvai created a local starter estimate from the assignment type and deadline.",
        suggestedSteps: [
          "Review the assignment instructions",
          "Complete a focused first pass",
          "Check and submit",
        ],
      },
    };
    addAssignment(assignment);
    reset();
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a manual assignment"
      description="Saved only in this browser during Phase 1."
    >
      <form onSubmit={handleSubmit(submit)}>
        <div className="form-grid">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>Assignment title</span>
            <input {...register("title")} placeholder="e.g. Chemistry lab reflection" />
            {errors.title && <span className="field-error">{errors.title.message}</span>}
          </label>
          <label className="field">
            <span>Course</span>
            <select {...register("courseId")}>
              {courses.map((course) => (
                <option value={course.id} key={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select {...register("type")}>
              {["homework", "essay", "test", "presentation", "reading", "project"].map((type) => (
                <option key={type} value={type}>
                  {type[0].toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Due date and time</span>
            <input type="datetime-local" {...register("dueAt")} />
            {errors.dueAt && <span className="field-error">{errors.dueAt.message}</span>}
          </label>
          <label className="field">
            <span>Estimated minutes</span>
            <input type="number" {...register("estimatedMinutes", { valueAsNumber: true })} />
            {errors.estimatedMinutes && <span className="field-error">10–600 minutes</span>}
          </label>
          <label className="field">
            <span>Points</span>
            <input type="number" {...register("points", { valueAsNumber: true })} />
          </label>
        </div>
        <div className="form-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Add assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
