using Microsoft.EntityFrameworkCore;
using PlanCraft.Api;
using static PlanCraft.Api.GridModels;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5058");

builder.Services.AddDbContext<PlanCraftDb>(opt => {
    var cs = builder.Configuration.GetConnectionString("Postgres");
    opt.UseNpgsql(cs);
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(opt => {
    opt.AddPolicy("ui", p => p
        .WithOrigins("http://localhost:5173","http://127.0.0.1:5173")
        .AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();
app.UseCors("ui");
app.UseSwagger();
app.UseSwaggerUI();

// Ensure DB and seed
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlanCraftDb>();
    //db.Database.EnsureCreated();
    db.Database.Migrate();
    if (!db.People.Any()) Seed.Load(db, Path.Combine(app.Environment.ContentRootPath, "data", "seed.json"));
}

// Basic endpoints
var api = app.MapGroup("/api");

api.MapGet("/people", async (PlanCraftDb db) => await db.People.OrderBy(p=>p.Name).ToListAsync());
api.MapPost("/people", async (PlanCraftDb db, Person p) => { db.People.Add(p); await db.SaveChangesAsync(); return Results.Created($"/api/people/{p.Id}", p); });
api.MapPut("/people/{id:int}", async (PlanCraftDb db, int id, Person p) => { p.Id=id; db.Update(p); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapDelete("/people/{id:int}", async (PlanCraftDb db, int id) => { var p=await db.People.FindAsync(id); if(p==null) return Results.NotFound(); db.Remove(p); await db.SaveChangesAsync(); return Results.NoContent(); });

api.MapGet("/banks", async (PlanCraftDb db) => await db.Banks.OrderBy(b=>b.Name).ToListAsync());
api.MapGet("/projects", async (PlanCraftDb db) => await db.Projects.Include(p=>p.Bank).OrderBy(p=>p.Name).ToListAsync());

api.MapGet("/tasks", async (PlanCraftDb db) => new {
    tasks = await db.Tasks.OrderBy(t=>t.StartDate).ToListAsync(),
    assignments = await db.TaskAssignments.ToListAsync(),
    deps = await db.TaskDependencies.ToListAsync(),
    milestones = await db.ProjectMilestones.ToListAsync()
});

api.MapPost("/tasks", async(PlanCraftDb db, TaskItem t) => { db.Tasks.Add(t); await db.SaveChangesAsync(); return Results.Created($"/api/tasks/{t.Id}", t); });
api.MapPut("/tasks/{id:int}", async(PlanCraftDb db, int id, TaskItem t) => { t.Id=id; db.Update(t); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapDelete("/tasks/{id:int}", async(PlanCraftDb db, int id) => { var t=await db.Tasks.FindAsync(id); if(t==null) return Results.NotFound(); db.Remove(t); await db.SaveChangesAsync(); return Results.NoContent(); });

api.MapPost("/assignments", async(PlanCraftDb db, TaskAssignment a) => { db.TaskAssignments.Add(a); await db.SaveChangesAsync(); return Results.Created($"/api/assignments/{a.Id}", a); });
api.MapPut("/assignments/{id:int}", async(PlanCraftDb db, int id, TaskAssignment a) => { a.Id=id; db.Update(a); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapDelete("/assignments/{id:int}", async(PlanCraftDb db, int id) => { var a=await db.TaskAssignments.FindAsync(id); if(a==null) return Results.NotFound(); db.Remove(a); await db.SaveChangesAsync(); return Results.NoContent(); });

api.MapGet("/plan/grid", async (PlanCraftDb db, DateTime from, DateTime to) =>
{
    var weeks = DateUtil.WeekStarts(from, to).Select((w,idx) => new WeekInfo(w, w.AddDays(7), idx)).ToList();

    var people = await db.People.OrderBy(p=>p.Name).ToListAsync();
    var tasks = await db.Tasks.Include(t=>t.Project).ThenInclude(p=>p!.Bank).ToListAsync();
    var assigns = await db.TaskAssignments.ToListAsync();
    var deps = await db.TaskDependencies.ToListAsync();
    var milestones = await db.ProjectMilestones.Include(m=>m.Project).ThenInclude(p=>p!.Bank).ToListAsync();

    List<PersonRow> rows = new();
    foreach (var p in people)
    {
        var util = weeks.Select(w => 0.0).ToList();
        var tlist = new List<GridTask>();

        // compute utilization
        foreach (var w in weeks)
        {
            double hours = 0;
            foreach (var a in assigns.Where(a=>a.PersonId==p.Id))
            {
                var t = tasks.First(t=>t.Id==a.TaskId);
                var days = DateUtil.OverlapDays(t.StartDate, t.DurationDays, w.Start);
                if (days<=0) continue;
                hours += days * 8.0 * (a.SharePercent/100.0);
            }
            util[w.Index] = p.CapacityHoursPerWeek>0 ? Math.Min(1.5, hours / p.CapacityHoursPerWeek) : 0;
        }

        // tasks shown on primary owner row
        foreach (var a in assigns.Where(x=>x.PersonId==p.Id && x.IsPrimary))
        {
            var t = tasks.First(t=>t.Id==a.TaskId);
            var wStartIdx = weeks.FindIndex(w => w.Start <= t.StartDate && t.StartDate < w.End);
            if (wStartIdx < 0) continue;
            var span = Math.Max(1, (int)Math.Ceiling(t.DurationDays / 7.0));
            var projectName = t.Project?.Name ?? "Project";
            var color = t.Project?.Color ?? t.Project?.Bank?.Color ?? "#60a5fa";

            var assignmentDtos = assigns.Where(z=>z.TaskId==t.Id)
                .Select(z=> new Assignment(z.PersonId, z.SharePercent, z.IsPrimary)).ToList();
            var depIds = deps.Where(d=>d.TaskId==t.Id).Select(d=>d.DependsOnTaskId).ToArray();

            tlist.Add(new GridTask(t.Id, t.Title, projectName, color!, wStartIdx, span, t.EstimatedDays, t.DurationDays, assignmentDtos, depIds, t.Status.ToString()));
        }

        rows.Add(new PersonRow(p.Id, p.Name, p.CapacityHoursPerWeek, util, tlist));
    }

    var ms = milestones.Select(m => new Milestone(m.Project!.Name, m.Name, m.Date, m.Project!.Color ?? m.Project!.Bank!.Color)).ToList();
    return Results.Ok(new GridResponse(weeks, rows, ms));
});

api.MapPost("/plan/move", async(PlanCraftDb db, MoveReq req) =>
{
    var task = await db.Tasks.FindAsync(req.TaskId);
    if (task == null) return Results.NotFound();

    if (req.NewStartDate.HasValue) task.StartDate = DateTime.SpecifyKind(req.NewStartDate.Value, DateTimeKind.Utc);
    var primary = await db.TaskAssignments.FirstOrDefaultAsync(a=>a.TaskId==req.TaskId && a.IsPrimary);
    if (req.NewPrimaryPersonId.HasValue)
    {
        if (primary != null) { primary.PersonId = req.NewPrimaryPersonId.Value; db.TaskAssignments.Update(primary); }
        else { db.TaskAssignments.Add(new TaskAssignment{ TaskId=req.TaskId, PersonId=req.NewPrimaryPersonId.Value, SharePercent=100, IsPrimary=true }); }
    }

    await db.SaveChangesAsync();
    return Results.Ok(task);
});

api.MapPost("/plan/autobalance", async(PlanCraftDb db, BalanceReq req) =>
{
    var moves = await PlanningLogic.AutoBalanceAsync(db, req.From, req.To, req.TargetLoad);
    return Results.Ok(new { proposals = moves });
});

api.MapGet("/suggestions/backlog", async(PlanCraftDb db, int personId, DateTime from, DateTime to) =>
{
    var unassigned = await db.Tasks.Where(t => t.Status== PlanCraft.Api.TaskStatus.Backlog || !db.TaskAssignments.Any(a=>a.TaskId==t.Id))
                                   .Include(t=>t.Project).ThenInclude(p=>p!.Bank)
                                   .OrderBy(t=>t.StartDate).Take(25).ToListAsync();
    return Results.Ok(unassigned.Select(t => new {
        t.Id, t.Title, Project = t.Project!.Name, Color = t.Project!.Color ?? t.Project!.Bank!.Color, t.EstimatedDays, t.RequiredSkills
    }));
});

app.Run();

public record MoveReq(int TaskId, DateTime? NewStartDate, int? NewPrimaryPersonId);
public record BalanceReq(DateTime From, DateTime To, double TargetLoad = 0.85);
