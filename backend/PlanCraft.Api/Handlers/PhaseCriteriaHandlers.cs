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

    public static async Task<IResult> UpdateByCriteriaId(PlanCraftDb db, int id, PhaseAcceptanceCriteria c)
    {
        var found = await db.PhaseAcceptanceCriteria.FirstOrDefaultAsync(x => x.Id == id);
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

    public static async Task<IResult> DeleteByCriteriaId(PlanCraftDb db, int id)
    {
        var found = await db.PhaseAcceptanceCriteria.FindAsync(id);
        if (found is null) return Results.NotFound();
        db.Remove(found);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }


    // PATCH /phases/{phaseId}/criteria/{id}/status
    public static async Task<IResult> SetStatus(PlanCraftDb db, int phaseId, int id, CriteriaStatusDto dto)
    {
        var found = await db.PhaseAcceptanceCriteria
            .FirstOrDefaultAsync(x => x.Id == id && x.PhaseId == phaseId);
        if (found is null)
            return Results.NotFound(new { error = "Criterion not found for given phase." });

        if (!TryMapStatus(dto.Status, out var newStatus))
            return Results.BadRequest(new { error = "Invalid status value." });

        found.Status = newStatus;

        // If you don't have a Note column, keep the next line as you already had:
        // WARNING: this overwrites Description; switch to found.Note if your model has it.
        if (!string.IsNullOrWhiteSpace(dto.Note))
            found.Description = dto.Note.Trim();

        await db.SaveChangesAsync();
        return Results.Ok(new { found.Id, found.PhaseId, Status = (int)found.Status, found.Description });
    }

    // OPTIONAL: PATCH /criteria/{id}/status  (no phaseId in URL)
    public static async Task<IResult> SetStatusById(PlanCraftDb db, int id, CriteriaStatusDto dto)
    {
        var found = await db.PhaseAcceptanceCriteria.FirstOrDefaultAsync(x => x.Id == id);
        if (found is null) return Results.NotFound();

        if (!TryMapStatus(dto.Status, out var newStatus))
            return Results.BadRequest(new { error = "Invalid status value." });

        found.Status = newStatus;
        if (!string.IsNullOrWhiteSpace(dto.Note))
            found.Description = dto.Note.Trim();

        await db.SaveChangesAsync();
        return Results.Ok(new { found.Id, found.PhaseId, Status = (int)found.Status, found.Description });
    }

    // POST /phases/{phaseId}/criteria/reorder
    public static async Task<IResult> Reorder(PlanCraftDb db, int phaseId, ReorderCriteriaDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Count == 0)
            return Results.BadRequest(new { error = "ids required" });

        var items = await db.PhaseAcceptanceCriteria
            .Where(x => x.PhaseId == phaseId)
            .ToListAsync();

        var dict = items.ToDictionary(x => x.Id);
        var order = 1;
        foreach (var id in dto.Ids)
            if (dict.TryGetValue(id, out var item))
                item.Order = order++;

        await db.SaveChangesAsync();
        return Results.Ok(new { updated = order - 1 });
    }

    // Helper to map int -> enum safely
    private static bool TryMapStatus(int value, out AcceptanceStatus status)
    {
        if (Enum.IsDefined(typeof(AcceptanceStatus), value))
        {
            status = (AcceptanceStatus)value;
            return true;
        }
        status = default;
        return false;
    }
}

// NEW: payload for status-only update
public sealed class CriteriaStatusDto
{
    public int Status { get; set; }        // 0 Reset, 1 Pass, 2 Fail, 3 AcceptWithNote
    public string? Note { get; set; }      // optional
}

public sealed class ReorderCriteriaDto
{
    public List<int> Ids { get; set; } = new(); // ordered list of criterion IDs
}
