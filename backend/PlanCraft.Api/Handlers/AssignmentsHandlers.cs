using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Handlers;

public static class AssignmentsHandlers
{
    public static Task<List<TaskAssignment>> GetAll(PlanCraftDb db)
        => db.TaskAssignments.ToListAsync();

    public static async Task<IResult> Create(PlanCraftDb db, TaskAssignment a)
    {
        db.TaskAssignments.Add(a);
        await db.SaveChangesAsync();
        return Results.Created($"/api/assignments/{a.Id}", a);
    }

    public static async Task<IResult> Update(PlanCraftDb db, int id, TaskAssignment a)
    {
        a.Id = id;
        db.Update(a);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public static async Task<IResult> Delete(PlanCraftDb db, int id)
    {
        var a = await db.TaskAssignments.FindAsync(id);
        if (a == null) return Results.NotFound();
        db.Remove(a);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
