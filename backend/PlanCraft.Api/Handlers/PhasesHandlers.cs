using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PhasesHandlers
{
    public static async Task<List<ProjectPhase>> GetByProject(PlanCraftDb db, int projectId)
    {
        var phases = await db.ProjectPhases.Where(x => x.ProjectId == projectId).OrderBy(x => x.Id).ToListAsync();
        foreach (var p in phases)
        {
            var criteria = await db.PhaseAcceptanceCriteria.Where(c => c.PhaseId == p.Id).ToListAsync();
            var total = Math.Max(criteria.Count(c => c.IsRequired), 1);
            var run = await db.PhaseAcceptanceRuns.Where(r => r.PhaseId == p.Id).OrderByDescending(r => r.VerifiedAt).FirstOrDefaultAsync();
            var results = run is null ? new List<PhaseAcceptanceResult>() :
                await db.PhaseAcceptanceResults.Where(r => r.RunId == run.Id).ToListAsync();
            double score = 0;
            foreach (var c in criteria.Where(c => c.IsRequired))
            {
                var r = results.FirstOrDefault(x => x.CriteriaId == c.Id);
                if (r is null) continue;
                score += r.Status switch
                {
                    AcceptanceStatus.Pass => 1.0,
                    AcceptanceStatus.AcceptedWithNote => 0.8,
                    _ => 0.0
                };
            }
            var tasksQ = db.Tasks.Where(t => t.PhaseId == p.Id);
            var totalTasks = await tasksQ.CountAsync();
            double tasksScore = 0;
            if (totalTasks > 0)
            {
                var done = await tasksQ.CountAsync(t => t.Status == TaskStatus.Done);
                tasksScore = (double)done / totalTasks;
            }
            p.PercentageComplete = Math.Round(100 * (0.7 * (score / total) + 0.3 * tasksScore), 1);
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

        // patch only what the UI edits
        existing.Title = ph.Title?.Trim() ?? existing.Title;
        existing.EstimatedDays = ph.EstimatedDays > 0 ? ph.EstimatedDays : existing.EstimatedDays;

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
