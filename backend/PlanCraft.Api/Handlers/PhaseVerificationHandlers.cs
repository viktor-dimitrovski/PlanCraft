using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PhaseVerificationHandlers
{
    public static async Task<IResult> StartRun(PlanCraftDb db, int phaseId, StartRunReq req)
    {
        var phase = await db.ProjectPhases.FindAsync(phaseId);
        if (phase is null) return Results.NotFound(new { error = "Phase not found" });
        var run = new PhaseAcceptanceRun { PhaseId = phaseId, VerifiedByPersonId = req.VerifiedByPersonId, VerifiedAt = DateTime.UtcNow, OverallStatus = VerificationStatus.InProgress };
        db.PhaseAcceptanceRuns.Add(run);
        await db.SaveChangesAsync();
        return Results.Ok(new { runId = run.Id });
    }

    public static async Task<IResult> UpsertResult(PlanCraftDb db, int phaseId, int runId, UpsertResultReq req)
    {
        var run = await db.PhaseAcceptanceRuns.FirstOrDefaultAsync(r => r.Id == runId && r.PhaseId == phaseId);
        if (run is null) return Results.NotFound(new { error = "Run not found" });

        var existing = await db.PhaseAcceptanceResults.FirstOrDefaultAsync(r => r.RunId == runId && r.CriteriaId == req.CriteriaId);
        if (existing is null)
        {
            existing = new PhaseAcceptanceResult { RunId = runId, CriteriaId = req.CriteriaId, Status = req.Status, Note = req.Note };
            db.PhaseAcceptanceResults.Add(existing);
        }
        else
        {
            existing.Status = req.Status;
            existing.Note = req.Note;
        }
        await db.SaveChangesAsync();
        return Results.Ok(existing);
    }

    public static async Task<IResult> FinalizeRun(PlanCraftDb db, int phaseId, int runId, FinalizeRunReq req)
    {
        var run = await db.PhaseAcceptanceRuns.FirstOrDefaultAsync(r => r.Id == runId && r.PhaseId == phaseId);
        if (run is null) return Results.NotFound(new { error = "Run not found" });
        run.OverallStatus = req.OverallStatus;
        run.VerifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(run);
    }

    public static async Task<IResult> Progress(PlanCraftDb db, int phaseId)
    {
        var phase = await db.ProjectPhases.Include(p => p.AcceptanceCriteria).FirstOrDefaultAsync(p => p.Id == phaseId);
        if (phase is null) return Results.NotFound(new { error = "Phase not found" });

        // latest run
        var run = await db.PhaseAcceptanceRuns.Where(r => r.PhaseId == phaseId).OrderByDescending(r => r.VerifiedAt).FirstOrDefaultAsync();
        var results = run is null ? new List<PhaseAcceptanceResult>() :
            await db.PhaseAcceptanceResults.Where(r => r.RunId == run.Id).ToListAsync();

        var total = Math.Max(phase.AcceptanceCriteria.Count(c => c.IsRequired), 1);
        double score = 0;
        foreach (var c in phase.AcceptanceCriteria.Where(c => c.IsRequired))
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

        // tasks progress (fallback, if any tasks in phase)
        var tasksQ = db.Tasks.Where(t => t.PhaseId == phaseId);
        var totalTasks = await tasksQ.CountAsync();
        double tasksScore = 0;
        if (totalTasks > 0)
        {
            var done = await tasksQ.CountAsync(t => t.Status == TaskStatus.Done);
            tasksScore = (double)done / totalTasks;
        }

        var percent = Math.Round(100 * (0.7 * (score / total) + 0.3 * tasksScore), 1);
        return Results.Ok(new { phaseId, percent });
    }
}

public record StartRunReq(int? VerifiedByPersonId);
public record UpsertResultReq(int CriteriaId, AcceptanceStatus Status, string? Note);
public record FinalizeRunReq(VerificationStatus OverallStatus);
