using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PhaseCriteriaHandlers
{
    public static Task<List<PhaseAcceptanceCriteria>> List(PlanCraftDb db, int phaseId)
        => db.PhaseAcceptanceCriteria.Where(c => c.PhaseId == phaseId).OrderBy(c => c.Order).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, int phaseId, PhaseAcceptanceCriteria c)
    {
        c.PhaseId = phaseId;
        db.PhaseAcceptanceCriteria.Add(c);
        await db.SaveChangesAsync();
        return Results.Created($"/api/phases/{phaseId}/criteria/{c.Id}", c);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int phaseId, int id, PhaseAcceptanceCriteria c)
    {
        var found = await db.PhaseAcceptanceCriteria.FirstOrDefaultAsync(x => x.Id == id && x.PhaseId == phaseId);
        if (found is null) return Results.NotFound();
        found.Title = c.Title;
        found.Description = c.Description;
        found.Order = c.Order;
        found.IsRequired = c.IsRequired;
        await db.SaveChangesAsync();
        return Results.Ok(found);
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int phaseId, int id)
    {
        var found = await db.PhaseAcceptanceCriteria.FirstOrDefaultAsync(x => x.Id == id && x.PhaseId == phaseId);
        if (found is null) return Results.NotFound();
        db.Remove(found);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
