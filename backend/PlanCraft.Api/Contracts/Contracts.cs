namespace PlanCraft.Api.Contracts;

public record PlanPhaseReq(int PersonId, DateTime StartDateUtc, string[]? RequiredSkills);
public record MoveReq(int TaskId, DateTime? NewStartDate, int? NewPrimaryPersonId, int? NewDurationDays, bool Copy);
public record BalanceReq(DateTime From, DateTime To, double TargetLoad = 0.85);

public record PhaseCriteriaDto(int Id, int PhaseId, string Title, string? Description, int Order, bool IsRequired);
public record StartRunReq(int? VerifiedByPersonId);
public record UpsertResultReq(int CriteriaId, AcceptanceStatus Status, string? Note);
public record FinalizeRunReq(VerificationStatus OverallStatus);
