using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PhaseAssignmentHandlers
{
    public static Task<List<PhaseAssignment>> List(PlanCraftDb db, int phaseId)
        => db.PhaseAssignments.Where(a => a.PhaseId == phaseId).OrderBy(a => a.Id).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, int phaseId, PhaseAssignment a)
    {
        a.PhaseId = phaseId;
        db.PhaseAssignments.Add(a);
        await db.SaveChangesAsync();
        await RecalcAssigned(db, phaseId);
        return Results.Created($"/api/phases/{phaseId}/assignments/{a.Id}", a);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int phaseId, int id, PhaseAssignment a)
    {
        var found = await db.PhaseAssignments.FirstOrDefaultAsync(x => x.Id == id && x.PhaseId == phaseId);
        if (found is null) return Results.NotFound();
        found.PersonId = a.PersonId;
        found.AssignedDays = a.AssignedDays;
        found.StartDate = a.StartDate;
        await db.SaveChangesAsync();
        await RecalcAssigned(db, phaseId);
        return Results.Ok(found);
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int phaseId, int id)
    {
        var found = await db.PhaseAssignments.FirstOrDefaultAsync(x => x.Id == id && x.PhaseId == phaseId);
        if (found is null) return Results.NotFound();
        db.Remove(found);
        await db.SaveChangesAsync();
        await RecalcAssigned(db, phaseId);
        return Results.NoContent();
    }

    private static async Task RecalcAssigned(PlanCraftDb db, int phaseId)
    {
        var total = await db.PhaseAssignments.Where(x => x.PhaseId == phaseId).SumAsync(x => (int?)x.AssignedDays) ?? 0;
        var phase = await db.ProjectPhases.FindAsync(phaseId);
        if (phase is not null)
        {
            phase.NoAssignedDays = total;
            await db.SaveChangesAsync();
        }
    }
}
