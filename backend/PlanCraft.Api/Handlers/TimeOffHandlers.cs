using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Handlers;

public static class TimeOffHandlers
{
    public static Task<List<PersonTimeOff>> GetAll(PlanCraftDb db)
        => db.TimeOffs.ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, PersonTimeOff x)
    {
        db.TimeOffs.Add(x);
        await db.SaveChangesAsync();
        return Results.Created($"/api/timeoff/{x.Id}", x);
    }
}
