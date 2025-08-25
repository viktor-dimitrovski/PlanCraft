using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PhasesHandlers
{

    public static async Task<IReadOnlyList<PhaseSummaryDto>> GetByProject(PlanCraftDb db, int projectId)
    {
        // 1) Fetch scalar phase fields for the grid
        var phases = await db.ProjectPhases
            .Where(p => p.ProjectId == projectId)
            .OrderBy(p => p.Id)
            .Select(p => new PhaseSummaryDto
            {
                Id = p.Id,
                ProjectId = p.ProjectId,
                Title = p.Title,
                EstimatedDays = p.EstimatedDays,
                StartDate = p.StartDate,
                Status = (int)p.Status,
                Description = p.Description,
                Priority = p.Priority,
                NoAssignedDays = p.NoAssignedDays,

                // AcceptanceRuns / Assignments kept as empty lists by default.
                // (Hydrate here if you actually need them in the grid.)
            })
            .ToListAsync();

        // 2) Compute required counts from latest verification run per phase
        foreach (var dto in phases)
        {
            // Required criteria for this phase
            var requiredIds = await db.PhaseAcceptanceCriteria
                .Where(c => c.PhaseId == dto.Id && c.IsRequired)
                .Select(c => c.Id)
                .ToListAsync();

            dto.RequiredTotal = requiredIds.Count;

            if (dto.RequiredTotal == 0)
            {
                dto.RequiredPassed = 0;
                dto.RequiredFailed = 0;
                dto.RequiredUntested = 0;
                dto.PercentageComplete = 0;
                continue;
            }

            // Latest run for this phase (if any)
            var runId = await db.PhaseAcceptanceRuns
                .Where(r => r.PhaseId == dto.Id)
                .OrderByDescending(r => r.VerifiedAt)
                .Select(r => (int?)r.Id)
                .FirstOrDefaultAsync();

            if (runId is null)
            {
                dto.RequiredPassed = 0;
                dto.RequiredFailed = 0;
                dto.RequiredUntested = dto.RequiredTotal;
                dto.PercentageComplete = 0;
                continue;
            }

            // Pull statuses only for required criteria in the latest run
            var statuses = await db.PhaseAcceptanceResults
                .Where(r => r.RunId == runId.Value && requiredIds.Contains(r.CriteriaId))
                .Select(r => r.Status)
                .ToListAsync();

            // Treat AcceptedWithNote as Passed
            var passed = statuses.Count(s => s == AcceptanceStatus.Pass || s == AcceptanceStatus.AcceptedWithNote);
            var failed = statuses.Count(s => s == AcceptanceStatus.Fail);
            var untested = Math.Max(0, dto.RequiredTotal - (passed + failed)); // anything else => untested

            dto.RequiredPassed = passed;
            dto.RequiredFailed = failed;
            dto.RequiredUntested = untested;

            dto.PercentageComplete = Math.Round(100.0 * passed / dto.RequiredTotal, 1);
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

public sealed class PhaseSummaryDto
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string? Title { get; set; }
    public int EstimatedDays { get; set; }
    public DateTime? StartDate { get; set; }
    public int Status { get; set; }
    public string? Description { get; set; }
    public int? Priority { get; set; }
    public int NoAssignedDays { get; set; }

    // Keep these, but we won't hydrate here (match your current JSON shape)
    public List<object> AcceptanceRuns { get; set; } = new();
    public List<object> Assignments { get; set; } = new();

    // New fields (concise & self-descriptive)
    public int RequiredTotal { get; set; }
    public int RequiredPassed { get; set; }     // Pass + AcceptedWithNote
    public int RequiredFailed { get; set; }     // Fail
    public int RequiredUntested { get; set; }   // not present in latest run / reset

    public double PercentageComplete { get; set; }  // = RequiredPassed / RequiredTotal * 100
}


