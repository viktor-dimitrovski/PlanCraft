using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class PeopleHandlers
{
    public static Task<List<Person>> GetAll(PlanCraftDb db)
        => db.People.OrderBy(p => p.Name).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, Person p)
    {
        db.People.Add(p);
        await db.SaveChangesAsync();
        return Results.Created($"/api/people/{p.Id}", p);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int id, Person p)
    {
        p.Id = id;
        db.Update(p);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }                                                                                                                                                               

    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var x = await db.People.FindAsync(id);
        if (x is null) return Results.NotFound();
        db.Remove(x);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
