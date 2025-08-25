using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PhasesHandlers
{

    public static async Task<List<ProjectPhase>> GetByProject(PlanCraftDb db, int projectId)
    {
        // Load phases first; if none, you're done.
        var phases = await db.ProjectPhases
            .Where(x => x.ProjectId == projectId)
            .OrderBy(x => x.Id)
            .ToListAsync();

        if (phases.Count == 0) return phases;

        foreach (var p in phases)
        {
            // Criteria (may be empty)
            var criteria = await db.PhaseAcceptanceCriteria
                .Where(c => c.PhaseId == p.Id)
                .ToListAsync();

            // Required criteria list + safe denominator (>= 1)
            var required = criteria.Where(c => c.IsRequired).ToList();
            var totalRequired = Math.Max(required.Count, 1);

            // Latest run id for the phase (null if none)
            var runId = await db.PhaseAcceptanceRuns
                .Where(r => r.PhaseId == p.Id)
                .OrderByDescending(r => r.VerifiedAt)
                .Select(r => (int?)r.Id)
                .FirstOrDefaultAsync();

            // Results for the latest run (empty if no run)
            var results = runId is null
                ? new List<PhaseAcceptanceResult>()
                : await db.PhaseAcceptanceResults
                    .Where(r => r.RunId == runId.Value)
                    .ToListAsync();

            // Build a lookup to avoid repeated FirstOrDefault per criterion
            var resultByCriteria = results
                .GroupBy(r => r.CriteriaId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

            double score = 0d;
            foreach (var c in required)
            {
                if (!resultByCriteria.TryGetValue(c.Id, out var r)) continue;
                score += r.Status switch
                {
                    AcceptanceStatus.Pass => 1.0,
                    AcceptanceStatus.AcceptedWithNote => 0.8,
                    _ => 0.0
                };
            }

            // Tasks may be empty; keep it safe
            var tasksQ = db.Tasks.Where(t => t.PhaseId == p.Id);
            var totalTasks = await tasksQ.CountAsync();
            double tasksScore = 0d;
            if (totalTasks > 0)
            {
                var done = await tasksQ.CountAsync(t => t.Status == TaskStatus.Done);
                tasksScore = (double)done / totalTasks;
            }

            // Final % (always defined thanks to safe denominators)
            p.PercentageComplete = Math.Round(100 * (0.7 * (score / totalRequired) + 0.3 * tasksScore), 1);
        }

        return phases;
    }


    public static async Task<IResult> Create(PlanCraftDb db, int projectId, ProjectPhase ph)
    {
        ph.ProjectId = projectId;
        db.ProjectPhases.Add(ph);
        await db.SaveChangesAsync();
        return Results.Created($"/api/projects/{projectId}/phases/{ph.Id}", ph);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int id, ProjectPhase ph)
    {
        var existing = await db.ProjectPhases.FindAsync(id);
        if (existing is null) return Results.NotFound();

        // Patch only what the UI edits
        if (!string.IsNullOrWhiteSpace(ph.Title))
            existing.Title = ph.Title.Trim();

        if (!string.IsNullOrWhiteSpace(ph.Description))
            existing.Description = ph.Description.Trim();

        if (ph.Priority > 0)
            existing.Priority = ph.Priority;

        if (ph.EstimatedDays > 0)
            existing.EstimatedDays = ph.EstimatedDays;

        if (ph.StartDate != default)
            existing.StartDate = ph.StartDate;

        // Status is an enum/int, allow 0..9 (Planned..Canceled) → update always
        existing.Status = ph.Status;

        // Can be null → set directly
        existing.DependantPhaseId = ph.DependantPhaseId;

        await db.SaveChangesAsync();
        return Results.NoContent();
    }



    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var ph = await db.ProjectPhases.FindAsync(id);
        if (ph is null) return Results.NotFound();
        db.ProjectPhases.Remove(ph);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public static async Task<IResult> DeletePlan(PlanCraftDb db, int id)
    {
        var tasks = await db.Tasks.Where(t => t.PhaseId == id).Select(t => new { t.Id }).ToListAsync();
        if (tasks.Count == 0) return Results.NoContent();

        var ids = tasks.Select(t => t.Id).ToList();
        db.TaskAssignments.RemoveRange(db.TaskAssignments.Where(a => ids.Contains(a.TaskId)));
        db.Tasks.RemoveRange(db.Tasks.Where(t => ids.Contains(t.Id)));
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    // “Plan phase”: turn a phase into a scheduled task (drop onto grid)
    public static async Task<IResult> PlanPhase(PlanCraftDb db, int id, PlanPhaseReq req)
    {
        var phase = await db.ProjectPhases.FirstOrDefaultAsync(p => p.Id == id);
        if (phase is null) return Results.NotFound(new { error = "Phase not found" });

        var startUtc = req.StartDateUtc.Kind == DateTimeKind.Utc
            ? req.StartDateUtc
            : DateTime.SpecifyKind(req.StartDateUtc, DateTimeKind.Utc);

        var t = new TaskItem
        {
            ProjectId = phase.ProjectId,
            PhaseId = phase.Id,
            Title = phase.Title,
            EstimatedDays = phase.EstimatedDays,
            DurationDays = Math.Max(1, phase.EstimatedDays),
            StartDate = startUtc,
            Status = PlanCraft.Api.TaskStatus.Planned,
            RequiredSkills = req.RequiredSkills ?? Array.Empty<string>()
        };

        db.Tasks.Add(t);
        await db.SaveChangesAsync();

        db.TaskAssignments.Add(new TaskAssignment
        {
            TaskId = t.Id,
            PersonId = req.PersonId,
            SharePercent = 100,
            IsPrimary = true
        });
        await db.SaveChangesAsync();

        return Results.Ok(new { id = t.Id, title = t.Title, projectId = t.ProjectId, phaseId = t.PhaseId });
    }
}
