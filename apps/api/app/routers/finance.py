"""Finance router - categories, funds, plan, requests, bank statements, income reports."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.finance import (
    FinanceCategory, Fund, FinancePlan, PurchaseRequest,
    FinancialPlanDocument, FinancialPlanning,
    BankStatement, BankStatementLine, IncomeReport,
)

router = APIRouter(prefix="/finance", tags=["finance"])


def row_to_category(row):
    return {
        "id": row.id,
        "name": row.name,
        "type": row.type,
        "value": float(row.value) if row.value and str(row.value).replace(".", "").isdigit() else row.value,
        "color": row.color,
    }


def row_to_fund(row):
    return {
        "id": row.id,
        "name": row.name,
        "order": int(row.order_val) if row.order_val and str(row.order_val).isdigit() else row.order_val,
        "isArchived": row.is_archived or False,
    }


def row_to_plan(row):
    return {
        "id": row.id,
        "period": row.period,
        "salesPlan": float(row.sales_plan) if row.sales_plan and str(row.sales_plan).replace(".", "").isdigit() else row.sales_plan,
        "currentIncome": float(row.current_income) if row.current_income and str(row.current_income).replace(".", "").isdigit() else row.current_income,
    }


def row_to_request(row):
    return {
        "id": row.id,
        "requesterId": row.requester_id,
        "departmentId": row.department_id,
        "categoryId": row.category_id,
        "amount": float(row.amount) if row.amount and str(row.amount).replace(".", "").isdigit() else row.amount,
        "description": row.description,
        "status": row.status,
        "date": row.date,
        "decisionDate": row.decision_date,
        "isArchived": row.is_archived or False,
    }


def row_to_plan_doc(row):
    return {
        "id": row.id,
        "departmentId": row.department_id,
        "period": row.period,
        "income": float(row.income) if row.income and str(row.income).replace(".", "").isdigit() else row.income,
        "expenses": row.expenses or {},
        "status": row.status,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "approvedBy": row.approved_by,
        "approvedAt": row.approved_at,
        "isArchived": row.is_archived or False,
    }


def row_to_planning(row):
    return {
        "id": row.id,
        "departmentId": row.department_id,
        "period": row.period,
        "planDocumentId": row.plan_document_id,
        "income": float(row.income) if row.income and str(row.income).replace(".", "").isdigit() else row.income,
        "fundAllocations": row.fund_allocations or {},
        "requestFundIds": row.request_fund_ids or {},
        "requestIds": row.request_ids or [],
        "status": row.status,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "approvedBy": row.approved_by,
        "approvedAt": row.approved_at,
        "notes": row.notes,
        "isArchived": row.is_archived or False,
    }


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinanceCategory))
    rows = result.scalars().all()
    if not rows:
        from app.seed_data import DEFAULT_FINANCE_CATEGORIES
        return DEFAULT_FINANCE_CATEGORIES
    return [row_to_category(r) for r in rows]


@router.put("/categories")
async def update_categories(categories: list[dict], db: AsyncSession = Depends(get_db)):
    for c in categories:
        cid = c.get("id")
        if not cid:
            continue
        existing = await db.get(FinanceCategory, cid)
        if existing:
            existing.name = c.get("name", existing.name)
            existing.type = c.get("type", existing.type)
            existing.value = str(c.get("value")) if c.get("value") is not None else None
            existing.color = c.get("color")
        else:
            db.add(FinanceCategory(
                id=cid,
                name=c.get("name", ""),
                type=c.get("type", "fixed"),
                value=str(c.get("value")) if c.get("value") is not None else None,
                color=c.get("color"),
            ))
    await db.commit()
    return {"ok": True}


@router.get("/funds")
async def get_funds(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Fund).where(Fund.is_archived == False))
    rows = result.scalars().all()
    if not rows:
        from app.seed_data import DEFAULT_FUNDS
        return sorted(DEFAULT_FUNDS, key=lambda x: x.get("order", 0))
    return sorted([row_to_fund(r) for r in rows], key=lambda x: x.get("order", 0))


@router.put("/funds")
async def update_funds(funds: list[dict], db: AsyncSession = Depends(get_db)):
    for f in funds:
        fid = f.get("id")
        if not fid:
            continue
        existing = await db.get(Fund, fid)
        if existing:
            existing.name = f.get("name", existing.name)
            existing.order_val = str(f.get("order", 0))
            existing.is_archived = f.get("isArchived", False)
        else:
            db.add(Fund(
                id=fid,
                name=f.get("name", ""),
                order_val=str(f.get("order", 0)),
                is_archived=f.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}


@router.get("/plan")
async def get_plan(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinancePlan).limit(1))
    row = result.scalar_one_or_none()
    if not row:
        return None
    return row_to_plan(row)


@router.put("/plan")
async def update_plan(plan: dict, db: AsyncSession = Depends(get_db)):
    pid = plan.get("id", "default")
    result = await db.execute(select(FinancePlan).limit(1))
    row = result.scalar_one_or_none()
    if row:
        row.period = plan.get("period", row.period)
        row.sales_plan = str(plan.get("salesPlan", row.sales_plan))
        row.current_income = str(plan.get("currentIncome", row.current_income))
    else:
        db.add(FinancePlan(
            id=pid,
            period=plan.get("period", "month"),
            sales_plan=str(plan.get("salesPlan", 0)),
            current_income=str(plan.get("currentIncome", 0)),
        ))
    await db.commit()
    return {"ok": True}


@router.get("/requests")
async def get_requests(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseRequest))
    return [row_to_request(r) for r in result.scalars().all()]


@router.put("/requests")
async def update_requests(requests: list[dict], db: AsyncSession = Depends(get_db)):
    for r in requests:
        rid = r.get("id")
        if not rid:
            continue
        existing = await db.get(PurchaseRequest, rid)
        if existing:
            existing.requester_id = r.get("requesterId", existing.requester_id)
            existing.department_id = r.get("departmentId", existing.department_id)
            existing.category_id = r.get("categoryId", existing.category_id)
            existing.amount = str(r.get("amount", existing.amount))
            existing.description = r.get("description", existing.description)
            existing.status = r.get("status", existing.status)
            existing.date = r.get("date", existing.date)
            existing.decision_date = r.get("decisionDate")
            existing.is_archived = r.get("isArchived", False)
        else:
            db.add(PurchaseRequest(
                id=rid,
                requester_id=r.get("userId", r.get("requesterId", "")),
                department_id=r.get("departmentId", ""),
                category_id=r.get("categoryId", ""),
                amount=str(r.get("amount", 0)),
                description=r.get("description", ""),
                status=r.get("status", "pending"),
                date=r.get("date", ""),
                decision_date=r.get("decisionDate"),
                is_archived=r.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}


@router.get("/financial-plan-documents")
async def get_financial_plan_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinancialPlanDocument))
    return [row_to_plan_doc(r) for r in result.scalars().all()]


@router.put("/financial-plan-documents")
async def update_financial_plan_documents(docs: list[dict], db: AsyncSession = Depends(get_db)):
    for d in docs:
        did = d.get("id")
        if not did:
            continue
        existing = await db.get(FinancialPlanDocument, did)
        if existing:
            existing.department_id = d.get("departmentId", existing.department_id)
            existing.period = d.get("period", existing.period)
            existing.income = str(d.get("income", existing.income))
            existing.expenses = d.get("expenses", existing.expenses or {})
            existing.status = d.get("status", existing.status)
            existing.created_at = d.get("createdAt", existing.created_at)
            existing.updated_at = d.get("updatedAt")
            existing.approved_by = d.get("approvedBy")
            existing.approved_at = d.get("approvedAt")
            existing.is_archived = d.get("isArchived", False)
        else:
            db.add(FinancialPlanDocument(
                id=did,
                department_id=d.get("departmentId", ""),
                period=d.get("period", ""),
                income=str(d.get("income", 0)),
                expenses=d.get("expenses", {}),
                status=d.get("status", "created"),
                created_at=d.get("createdAt", ""),
                updated_at=d.get("updatedAt"),
                approved_by=d.get("approvedBy"),
                approved_at=d.get("approvedAt"),
                is_archived=d.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}


@router.get("/financial-plannings")
async def get_financial_plannings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinancialPlanning))
    return [row_to_planning(r) for r in result.scalars().all()]


@router.put("/financial-plannings")
async def update_financial_plannings(plannings: list[dict], db: AsyncSession = Depends(get_db)):
    for p in plannings:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(FinancialPlanning, pid)
        if existing:
            existing.department_id = p.get("departmentId", existing.department_id)
            existing.period = p.get("period", existing.period)
            existing.plan_document_id = p.get("planDocumentId")
            existing.income = str(p.get("income")) if p.get("income") is not None else None
            existing.fund_allocations = p.get("fundAllocations", existing.fund_allocations or {})
            existing.request_fund_ids = p.get("requestFundIds", existing.request_fund_ids or {})
            existing.request_ids = p.get("requestIds", existing.request_ids or [])
            existing.status = p.get("status", existing.status)
            existing.created_at = p.get("createdAt", existing.created_at)
            existing.updated_at = p.get("updatedAt")
            existing.approved_by = p.get("approvedBy")
            existing.approved_at = p.get("approvedAt")
            existing.notes = p.get("notes")
            existing.is_archived = p.get("isArchived", False)
        else:
            db.add(FinancialPlanning(
                id=pid,
                department_id=p.get("departmentId", ""),
                period=p.get("period", ""),
                plan_document_id=p.get("planDocumentId"),
                income=str(p.get("income")) if p.get("income") is not None else None,
                fund_allocations=p.get("fundAllocations", {}),
                request_fund_ids=p.get("requestFundIds", {}),
                request_ids=p.get("requestIds", []),
                status=p.get("status", "created"),
                created_at=p.get("createdAt", ""),
                updated_at=p.get("updatedAt"),
                approved_by=p.get("approvedBy"),
                approved_at=p.get("approvedAt"),
                notes=p.get("notes"),
                is_archived=p.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}


# --- Bank statements (выписки) ---

def _row_to_statement(row, lines=None):
    return {
        "id": row.id,
        "name": row.name,
        "period": row.period,
        "createdAt": row.created_at,
        "lines": lines or [],
    }


def _row_to_statement_line(row):
    return {
        "id": row.id,
        "statementId": row.statement_id,
        "lineDate": row.line_date,
        "description": row.description,
        "amount": float(row.amount) if row.amount and str(row.amount).replace(".", "").replace("-", "").isdigit() else row.amount,
        "lineType": row.line_type,
    }


@router.get("/bank-statements")
async def get_bank_statements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BankStatement).order_by(BankStatement.created_at))
    statements = result.scalars().all()
    out = []
    for st in statements:
        lines_r = await db.execute(select(BankStatementLine).where(BankStatementLine.statement_id == st.id))
        lines = [_row_to_statement_line(l) for l in lines_r.scalars().all()]
        out.append(_row_to_statement(st, lines))
    return out


@router.put("/bank-statements")
async def update_bank_statements(payload: list[dict], db: AsyncSession = Depends(get_db)):
    for s in payload:
        sid = s.get("id")
        if not sid:
            continue
        existing = await db.get(BankStatement, sid)
        if existing:
            existing.name = s.get("name", existing.name)
            existing.period = s.get("period", existing.period)
            existing.created_at = s.get("createdAt", existing.created_at)
        else:
            db.add(BankStatement(
                id=sid,
                name=s.get("name"),
                period=s.get("period"),
                created_at=s.get("createdAt", ""),
            ))
        await db.flush()
        lines = s.get("lines", [])
        await db.execute(delete(BankStatementLine).where(BankStatementLine.statement_id == sid))
        for ln in lines:
            lid = ln.get("id") or __import__("uuid").uuid4().__str__()
            db.add(BankStatementLine(
                id=lid,
                statement_id=sid,
                line_date=ln.get("lineDate", ""),
                description=ln.get("description"),
                amount=str(ln.get("amount", 0)),
                line_type=ln.get("lineType", "in"),
            ))
    await db.commit()
    return {"ok": True}


@router.delete("/bank-statements/{statement_id}")
async def delete_bank_statement(statement_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(BankStatementLine).where(BankStatementLine.statement_id == statement_id))
    st = await db.get(BankStatement, statement_id)
    if st:
        await db.delete(st)
    await db.commit()
    return {"ok": True}


# --- Income reports (отчёты по приходам) ---

def _row_to_income_report(row):
    return {
        "id": row.id,
        "period": row.period,
        "data": row.data or {},
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


@router.get("/income-reports")
async def get_income_reports(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncomeReport))
    return [_row_to_income_report(r) for r in result.scalars().all()]


@router.put("/income-reports")
async def update_income_reports(payload: list[dict], db: AsyncSession = Depends(get_db)):
    for r in payload:
        rid = r.get("id")
        if not rid:
            continue
        existing = await db.get(IncomeReport, rid)
        if existing:
            existing.period = r.get("period", existing.period)
            existing.data = r.get("data", existing.data or {})
            existing.created_at = r.get("createdAt", existing.created_at)
            existing.updated_at = r.get("updatedAt")
        else:
            db.add(IncomeReport(
                id=rid,
                period=r.get("period", ""),
                data=r.get("data", {}),
                created_at=r.get("createdAt", ""),
                updated_at=r.get("updatedAt"),
            ))
    await db.commit()
    return {"ok": True}
