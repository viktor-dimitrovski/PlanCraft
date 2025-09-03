using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Handlers;

public static class HolidaysHandlers
{
    public static Task<List<Holiday>> GetAll(PlanCraftDb db)
        => db.Holidays.ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, Holiday h)
    {
        db.Holidays.Add(h);
        await db.SaveChangesAsync();
        return Results.Created($"/api/holidays/{h.Id}", h);
    }
}
