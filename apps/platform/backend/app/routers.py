"""Router registration for the FastAPI entrypoint.

Kept in registration order: path specificity matters for the catch-all proxy,
which MUST be registered last among the API routers.
"""

from __future__ import annotations

from fastapi import FastAPI

from backend.api import (
    ai,
    analytics,
    assignments,
    auth,
    bookmarks,
    branding,
    casuya_api_proxy,
    classrooms,
    core,
    games,
    lessons,
    math,
    metrics,
    note,
    notifications,
    oauth,
    orchestrator,
    payments,
    progress,
    quizzes,
    reference_docs,
    search,
    services_bridge,
    settings as settings_api,
    students,
    subjects,
    subtopics,
    syllabus,
    teachers,
    teacher_plans,
    topics,
    transcode,
    uploads,
    users,
)


def include_routers(app: FastAPI) -> None:
    for router_module in (
        auth,
        branding,
        users,
        students,
        teachers,
        classrooms,
        lessons,
        subjects,
        topics,
        subtopics,
        syllabus,
        quizzes,
        games,
        progress,
        analytics,
        core,
        payments,
        notifications,
        orchestrator,
        search,
        services_bridge,
        uploads,
        transcode,
        bookmarks,
        note,
        metrics,
        ai,
        math,
        assignments,
        settings_api,
        teacher_plans,
        reference_docs,
        # casuya_api_proxy MUST be last — catch-all /{path:path}
        casuya_api_proxy,
    ):
        app.include_router(router_module.router)

    # Merge oauth routes into the auth router so they share prefix="/auth"
    # without declaring it twice.
    app.include_router(oauth.router, prefix="/auth")