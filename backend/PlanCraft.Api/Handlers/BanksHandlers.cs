using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class BanksHandlers
{
    public static Task<List<Bank>> GetAll(PlanCraftDb db)
        => db.Banks.OrderBy(b => b.Name).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, Bank b)
    {
        db.Banks.Add(b);
        await db.SaveChangesAsync();
        return Results.Created($"/api/banks/{b.Id}", b);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int id, Bank b)
    {
        b.Id = id;
        db.Update(b);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var b = await db.Banks.FindAsync(id);
        if (b is null) return Results.NotFound();
        db.Remove(b);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
