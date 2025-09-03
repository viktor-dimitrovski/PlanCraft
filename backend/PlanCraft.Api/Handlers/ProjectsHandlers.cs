using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Handlers;

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

    public static async Task<IResult> DuplicatePhases(
        PlanCraftDb db,
        int sourceProjectId,
        int targetProjectId)
    {
        // 1) Суров DTO за читање (никакви навигации, никакви ентитети)
        //    Ова гарантира дека EF нема причина да додава JOIN.
        var source = await db.ProjectPhases
            .IgnoreAutoIncludes()    // спречи AutoInclude на сите навигации
            .AsNoTracking()
            .Where(p => p.ProjectId == sourceProjectId)
            .OrderBy(p => p.Id)
            .Select(p => new SimplePhaseDto
            {
                Id = p.Id,
                Title = p.Title,
                EstimatedDays = p.EstimatedDays,
                DurationDays = p.DurationDays,
                Description = p.Description,
                Priority = p.Priority,
                DependantPhaseId = p.DependantPhaseId
            })
            .ToListAsync();

        if (source.Count == 0)
            return Results.NotFound(new { message = "No phases found for source project" });

        // 2) Прв пас: креирај копии (reset полиња)
        var newPhases = new List<ProjectPhase>(source.Count);
        foreach (var sp in source)
        {
            newPhases.Add(new ProjectPhase
            {
                ProjectId = targetProjectId,
                Title = sp.Title,
                EstimatedDays = sp.EstimatedDays,
                NoAssignedDays = sp.EstimatedDays,   // reset
                StartDate = null,               // reset
                DurationDays = sp.DurationDays,
                Status = PhaseStatus.Planned,// reset
                Description = sp.Description,
                Priority = sp.Priority
                // НЕ поставуваме DependantPhaseId тука; го ремапираме после
                // НЕ користиме ParallelWith воопшто
            });
        }

        db.ProjectPhases.AddRange(newPhases);
        await db.SaveChangesAsync(); // добиј нови Id-ја

        // 3) Мапа Title -> нов Id (претпоставка: Title е уникатен по проект)
        var titleToNewId = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var np in newPhases)
            titleToNewId[np.Title] = np.Id;

        // 4) Втор пас: ремапирај dependent ако постои
        var changed = false;
        for (int i = 0; i < source.Count; i++)
        {
            var sp = source[i];
            if (sp.DependantPhaseId.HasValue)
            {
                // најди го стариот dependent во source по Id → добиј му Title → мапирај во нов Id
                var depOld = source.FirstOrDefault(x => x.Id == sp.DependantPhaseId.Value);
                if (depOld != null && titleToNewId.TryGetValue(depOld.Title, out var newDepId))
                {
                    newPhases[i].DependantPhaseId = newDepId;
                    changed = true;
                }
            }
        }

        if (changed)
            await db.SaveChangesAsync();

        // Врати само резиме за да не провоцираме сериализација на навигации
        return Results.Ok(new { inserted = newPhases.Count, targetProjectId });
    }

}

file sealed class SimplePhaseDto
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int EstimatedDays { get; set; }
    public int? DurationDays { get; set; }
    public string? Description { get; set; }
    public int Priority { get; set; }
    public int? DependantPhaseId { get; set; }
}
