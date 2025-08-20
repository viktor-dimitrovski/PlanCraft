using Microsoft.EntityFrameworkCore;
using PlanCraft.Api;
using Serilog;
using static PlanCraft.Api.GridModels;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

builder.Configuration.AddEnvironmentVariables();
var connStr = builder.Configuration.GetConnectionString("Postgres")
              ?? builder.Configuration["ConnectionStrings__Postgres"]
              ?? "Host=localhost;Port=5432;Database=plancraft;Username=postgres;Password=postgres";

builder.Services.AddDbContext<PlanCraftDb>(opt => opt.UseNpgsql(connStr));
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

app.Use(async (ctx, next) => {
    try { await next(); }
    catch (Exception ex) {
        Log.Error(ex, "Unhandled");
        ctx.Response.StatusCode = 500;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlanCraftDb>();
    db.Database.Migrate();
    if (!db.People.Any()) Seed.Load(db, Path.Combine(app.Environment.ContentRootPath, "data", "seed.json"));
}

var api = app.MapGroup("/api");

api.MapGet("/people", async (PlanCraftDb db) => await db.People.OrderBy(p=>p.Name).ToListAsync());
api.MapGet("/projects", async (PlanCraftDb db) => await db.Projects.Include(p=>p.Bank).OrderBy(p=>p.Name).ToListAsync());
api.MapGet("/tasks", async (PlanCraftDb db) => await db.Tasks.OrderBy(t=>t.StartDate).ToListAsync());
api.MapPost("/tasks", async(PlanCraftDb db, TaskItem t) => { t.StartDate = DateTime.SpecifyKind(t.StartDate, DateTimeKind.Utc); db.Tasks.Add(t); await db.SaveChangesAsync(); return Results.Created($"/api/tasks/{t.Id}", t); });
api.MapPut("/tasks/{id:int}", async(PlanCraftDb db, int id, TaskItem t) => { t.Id=id; t.StartDate = DateTime.SpecifyKind(t.StartDate, DateTimeKind.Utc); db.Update(t); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapDelete("/tasks/{id:int}", async(PlanCraftDb db, int id) => { var t=await db.Tasks.FindAsync(id); if(t==null) return Results.NotFound(); db.Remove(t); await db.SaveChangesAsync(); return Results.NoContent(); });

api.MapGet("/assignments", async(PlanCraftDb db) => await db.TaskAssignments.ToListAsync());
api.MapPost("/assignments", async(PlanCraftDb db, TaskAssignment a) => { db.TaskAssignments.Add(a); await db.SaveChangesAsync(); return Results.Created($"/api/assignments/{a.Id}", a); });
api.MapPut("/assignments/{id:int}", async(PlanCraftDb db, int id, TaskAssignment a) => { a.Id=id; db.Update(a); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapDelete("/assignments/{id:int}", async(PlanCraftDb db, int id) => { var a=await db.TaskAssignments.FindAsync(id); if(a==null) return Results.NotFound(); db.Remove(a); await db.SaveChangesAsync(); return Results.NoContent(); });

api.MapGet("/deps", async(PlanCraftDb db) => await db.TaskDependencies.ToListAsync());
api.MapPost("/deps", async(PlanCraftDb db, TaskDependency d) => { db.TaskDependencies.Add(d); await db.SaveChangesAsync(); return Results.Created($"/api/deps/{d.Id}", d); });
api.MapDelete("/deps/{id:int}", async(PlanCraftDb db, int id) => { var d=await db.TaskDependencies.FindAsync(id); if(d==null) return Results.NotFound(); db.Remove(d); await db.SaveChangesAsync(); return Results.NoContent(); });

api.MapGet("/timeoff", async(PlanCraftDb db) => await db.TimeOffs.ToListAsync());
api.MapPost("/timeoff", async(PlanCraftDb db, PersonTimeOff x) => { db.TimeOffs.Add(x); await db.SaveChangesAsync(); return Results.Created($"/api/timeoff/{x.Id}", x); });
api.MapGet("/holidays", async(PlanCraftDb db) => await db.Holidays.ToListAsync());
api.MapPost("/holidays", async(PlanCraftDb db, Holiday h) => { db.Holidays.Add(h); await db.SaveChangesAsync(); return Results.Created($"/api/holidays/{h.Id}", h); });

api.MapGet("/scenarios", async(PlanCraftDb db) => await db.Scenarios.OrderByDescending(s=>s.CreatedAt).ToListAsync());
api.MapPost("/scenarios", async(PlanCraftDb db, Scenario s) => { s.CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc); db.Scenarios.Add(s); await db.SaveChangesAsync(); return Results.Created($"/api/scenarios/{s.Id}", s); });
api.MapPost("/scenarios/{id:int}/override", async(PlanCraftDb db, int id, ScenarioTaskOverride o) => { o.ScenarioId=id; db.ScenarioOverrides.Add(o); await db.SaveChangesAsync(); return Results.Ok(o); });
api.MapGet("/scenarios/{id:int}/overrides", async(PlanCraftDb db, int id) => await db.ScenarioOverrides.Where(x=>x.ScenarioId==id).ToListAsync());

api.MapGet("/plan/grid", async (PlanCraftDb db, DateTime from, DateTime to, int? scenarioId) =>
{
    from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
    to   = DateTime.SpecifyKind(to,   DateTimeKind.Utc);

    var weeks = DateUtil.WeekStarts(from, to).Select((w,idx) => new WeekInfo(w, w.AddDays(7), idx)).ToList();

    var people = await db.People.OrderBy(p=>p.Name).ToListAsync();
    var tasks = await db.Tasks.Include(t=>t.Project).ThenInclude(p=>p!.Bank).ToListAsync();
    var assigns = await db.TaskAssignments.ToListAsync();
    var deps = await db.TaskDependencies.ToListAsync();
    var milestones = await db.ProjectMilestones.Include(m=>m.Project).ThenInclude(p=>p!.Bank).ToListAsync();

    if (scenarioId.HasValue)
    {
        var ovs = await db.ScenarioOverrides.Where(o=>o.ScenarioId==scenarioId.Value).ToListAsync();
        foreach (var o in ovs){
            var t = tasks.FirstOrDefault(x=>x.Id==o.TaskId);
            if (t == null) continue;
            if (o.StartDate.HasValue) t.StartDate = DateTime.SpecifyKind(o.StartDate.Value, DateTimeKind.Utc);
            if (o.DurationDays.HasValue) t.DurationDays = o.DurationDays.Value;
            if (o.PrimaryPersonId.HasValue){
                var prim = assigns.FirstOrDefault(a=>a.TaskId==t.Id && a.IsPrimary);
                if (prim!=null) prim.PersonId = o.PrimaryPersonId.Value;
            }
        }
    }

    var projGroups = tasks.GroupBy(t=>t.ProjectId).ToDictionary(
        g=>g.Key, g=>PlanningLogic.CriticalPath(g.First().Project!, g.ToList(), deps.Where(d=>g.Select(x=>x.Id).Contains(d.TaskId) || g.Select(x=>x.Id).Contains(d.DependsOnTaskId)).ToList())
    );

    List<PersonRow> rows = new();
    foreach (var p in people)
    {
        var util = weeks.Select(w => 0.0).ToList();
        var tlist = new List<GridTask>();

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
            var cap = PlanningLogic.EffectiveCapacity(db, p.Id, w.Start, p.CapacityHoursPerWeek);
            util[w.Index] = cap>0 ? Math.Min(1.5, hours / cap) : 0;
        }

        foreach (var a in assigns.Where(x=>x.PersonId==p.Id && x.IsPrimary))
        {
            var t = tasks.First(t=>t.Id==a.TaskId);
            var wStartIdx = weeks.FindIndex(w => w.Start <= t.StartDate && t.StartDate < w.End);
            if (wStartIdx < 0) continue;
            var span = Math.Max(1, (int)Math.Ceiling(t.DurationDays / 7.0));
            var projectName = t.Project?.Name ?? "Project";
            var color = t.Project?.Color ?? t.Project?.Bank?.Color ?? "#60a5fa";

            var assignmentDtos = assigns.Where(z=>z.TaskId==t.Id)
                .Select(z=> new Assignment(z.Id, z.PersonId, z.SharePercent, z.IsPrimary)).ToList();
            var depIds = deps.Where(d=>d.TaskId==t.Id).Select(d=>d.DependsOnTaskId).ToArray();
            var depDtos = deps.Where(d=>d.TaskId==t.Id)
                              .Select(d=> tasks.FirstOrDefault(x=>x.Id==d.DependsOnTaskId))
                              .Where(x=>x!=null)
                              .Select(x=> new DepDto(x!.Id, x.Title, x.Project!.Name)).ToList();
            var blocked = deps.Where(d=>d.TaskId==t.Id).Any(d => {
                var pred = tasks.First(x=>x.Id==d.DependsOnTaskId);
                var predEnd = pred.StartDate.AddDays(pred.DurationDays);
                return predEnd > t.StartDate;
            });

            var (criticalSet, slackDays) = projGroups[t.ProjectId];
            bool isCritical = criticalSet.Contains(t.Id);
            int slack = slackDays.ContainsKey(t.Id) ? slackDays[t.Id] : 0;

            tlist.Add(new GridTask(t.Id, t.Title, projectName, color!, wStartIdx, span, t.EstimatedDays, t.DurationDays, assignmentDtos, depIds, depDtos, t.Status.ToString(), blocked, isCritical, slack));
        }

        rows.Add(new PersonRow(p.Id, p.Name, p.CapacityHoursPerWeek, util, tlist, p.Color));
    }

    var ms = milestones.Select(m => new Milestone(m.Project!.Name, m.Name, m.Date, m.Project!.Color ?? m.Project!.Bank!.Color)).ToList();
    return Results.Ok(new GridResponse(weeks, rows, ms));
});

api.MapPost("/plan/move", async(PlanCraftDb db, MoveReq req) =>
{
    var task = await db.Tasks.FindAsync(req.TaskId);
    if (task == null) return Results.NotFound();

    if (req.Copy)
    {
        var clone = new TaskItem {
            ProjectId = task.ProjectId, Title = task.Title, EstimatedDays = task.EstimatedDays,
            StartDate = req.NewStartDate.HasValue ? DateTime.SpecifyKind(req.NewStartDate.Value, DateTimeKind.Utc) : task.StartDate,
            DurationDays = req.NewDurationDays ?? task.DurationDays,
            Status = task.Status, IsMilestone = task.IsMilestone, RequiredSkills = task.RequiredSkills,
            OptimisticDays = task.OptimisticDays, MostLikelyDays = task.MostLikelyDays, PessimisticDays = task.PessimisticDays
        };
        db.Tasks.Add(clone);
        await db.SaveChangesAsync();
        var assigns = db.TaskAssignments.Where(a=>a.TaskId==task.Id).ToList();
        foreach (var a in assigns) db.TaskAssignments.Add(new TaskAssignment { TaskId = clone.Id, PersonId = req.NewPrimaryPersonId ?? a.PersonId, SharePercent = a.SharePercent, IsPrimary = a.IsPrimary });
        await db.SaveChangesAsync();
        return Results.Ok(clone);
    }

    if (req.NewStartDate.HasValue) task.StartDate = DateTime.SpecifyKind(req.NewStartDate.Value, DateTimeKind.Utc);
    if (req.NewDurationDays.HasValue) task.DurationDays = Math.Max(1, req.NewDurationDays.Value);
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
    req = req with { From = DateTime.SpecifyKind(req.From, DateTimeKind.Utc), To = DateTime.SpecifyKind(req.To, DateTimeKind.Utc) };
    var moves = await PlanningLogic.AutoBalanceAsync(db, req.From, req.To, req.TargetLoad);
    return Results.Ok(new { proposals = moves });
});

api.MapGet("/plan/compare", async(PlanCraftDb db, int scenarioId) => {
    var tasks = await db.Tasks.Include(t=>t.Project).ToListAsync();
    var baseFinish = tasks.GroupBy(t=>t.ProjectId).ToDictionary(g=>g.Key, g=> g.Max(t=>t.StartDate.AddDays(t.DurationDays)));
    var ovs = await db.ScenarioOverrides.Where(o=>o.ScenarioId==scenarioId).ToListAsync();
    foreach(var o in ovs){
        var t = tasks.FirstOrDefault(x=>x.Id==o.TaskId);
        if (t==null) continue;
        var start = o.StartDate ?? t.StartDate;
        var dur = o.DurationDays ?? t.DurationDays;
        t = t with { StartDate = start, DurationDays = dur };
    }
    var scenFinish = tasks.GroupBy(t=>t.ProjectId).ToDictionary(g=>g.Key, g=> g.Max(t=>t.StartDate.AddDays(t.DurationDays)));
    var result = baseFinish.Select(kv => new {
        ProjectId = kv.Key,
        BaseFinish = kv.Value,
        ScenarioFinish = scenFinish[kv.Key],
        SlipDays = (scenFinish[kv.Key]-kv.Value).TotalDays
    });
    return Results.Ok(result);
});

api.MapGet("/plan/forecast", async(PlanCraftDb db, int projectId, int trials = 200) => {
    var tasks = await db.Tasks.Where(t=>t.ProjectId==projectId).ToListAsync();
    var deps = await db.TaskDependencies.ToListAsync();
    var rand = new Random(1);
    List<DateTime> finishes = new();
    for(int i=0;i<trials;i++){
        var dur = tasks.ToDictionary(t=>t.Id, t=>{
            int o=t.OptimisticDays ?? t.DurationDays, m=t.MostLikelyDays ?? t.DurationDays, p=t.PessimisticDays ?? t.DurationDays;
            return (int)Math.Round((o + 4*m + p)/6.0 + rand.NextDouble()*2 - 1);
        });
        var start = tasks.ToDictionary(t=>t.Id, t=>t.StartDate);
        bool changed=true; int guard=0;
        while(changed && guard<1000){
            changed=false; guard++;
            foreach(var t in tasks){
                var preds = deps.Where(d=>d.TaskId==t.Id).Select(d=>d.DependsOnTaskId);
                var latest = preds.Any()? preds.Max(pid => start[pid].AddDays(dur[pid])) : start[t.Id];
                if (latest > start[t.Id]) { start[t.Id] = latest; changed=true; }
            }
        }
        var finish = tasks.Max(t=> start[t.Id].AddDays(dur[t.Id]));
        finishes.Add(finish);
    }
    finishes.Sort();
    DateTime p50 = finishes[(int)(finishes.Count*0.5)];
    DateTime p90 = finishes[(int)(finishes.Count*0.9)];
    return Results.Ok(new { P50=p50, P90=p90, Trials=trials });
});

app.Run();

public record MoveReq(int TaskId, DateTime? NewStartDate, int? NewPrimaryPersonId, int? NewDurationDays, bool Copy);
public record BalanceReq(DateTime From, DateTime To, double TargetLoad = 0.85);
