using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Endpoints;

public static class ProjectsHandlers
{
    public static Task<List<Project>> GetAll(PlanCraftDb db)
        => db.Projects.Include(p => p.Bank).OrderBy(p => p.Name).ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, Project p)
    {
        db.Projects.Add(p);
        await db.SaveChangesAsync();
        return Results.Created($"/api/projects/{p.Id}", p);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int id, Project p)
    {
        p.Id = id;
        db.Update(p);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var x = await db.Projects.FindAsync(id);
        if (x is null) return Results.NotFound();
        db.Remove(x);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
