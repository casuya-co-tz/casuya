from __future__ import annotations


class ExamsMixin:
    # ─── Exams ─────────────────────────────────────────────────────────────
    def create_question(self, payload: dict) -> dict:
        return self._request("POST", "/exams/questions", json=payload)

    def get_question(self, question_id: str) -> dict:
        return self._request("GET", f"/exams/questions/{question_id}")

    def list_questions(self) -> list:
        return self._request("GET", "/exams/questions")

    def update_question(self, question_id: str, payload: dict) -> dict:
        return self._request("PUT", f"/exams/questions/{question_id}", json=payload)

    def delete_question(self, question_id: str) -> dict:
        return self._request("DELETE", f"/exams/questions/{question_id}")

    def filter_questions(self, payload: dict) -> dict:
        return self._request("POST", "/exams/questions/filter", json=payload)

    def create_exam_category(self, payload: dict) -> dict:
        return self._request("POST", "/exams/categories", json=payload)

    def list_exam_categories(self) -> list:
        return self._request("GET", "/exams/categories")

    def create_exam_tag(self, payload: dict) -> dict:
        return self._request("POST", "/exams/tags", json=payload)

    def list_exam_tags(self) -> list:
        return self._request("GET", "/exams/tags")

    def create_exam(self, payload: dict) -> dict:
        return self._request("POST", "/exams", json=payload)

    def get_exam(self, exam_id: str) -> dict:
        return self._request("GET", f"/exams/{exam_id}")

    def list_exams(self) -> list:
        return self._request("GET", "/exams")

    def publish_exam(self, exam_id: str) -> dict:
        return self._request("POST", f"/exams/{exam_id}/publish")

    def add_exam_section(self, exam_id: str, payload: dict) -> dict:
        return self._request("POST", f"/exams/{exam_id}/section", json=payload)

    def autofill_section(self, exam_id: str, section_id: str, criteria: dict | None = None) -> dict:
        return self._request(
            "POST", f"/exams/{exam_id}/autofill", json={"sectionId": section_id, "criteria": criteria or {}}
        )

    def schedule_exam(self, payload: dict) -> dict:
        return self._request("POST", "/exams/schedule", json=payload)

    def upcoming_exams(self, limit: int | None = None) -> list:
        return self._request("GET", "/exams/schedule/upcoming", params={"limit": limit} if limit else {})

    def start_session(self, payload: dict) -> dict:
        return self._request("POST", "/exams/sessions", json=payload)

    def submit_answer(self, session_id: str, payload: dict) -> dict:
        return self._request("POST", f"/exams/sessions/{session_id}/submit", json=payload)

    def complete_session(self, session_id: str) -> dict:
        return self._request("POST", f"/exams/sessions/{session_id}/complete")

    def grade(self, payload: dict) -> dict:
        return self._request("POST", "/exams/grade", json=payload)

    def exam_report(self, action: str, payload: dict) -> dict:
        return self._request("POST", f"/exams/reports/{action}", json=payload)

    def generate_certificate(self, payload: dict) -> dict:
        return self._request("POST", "/exams/certificates", json=payload)

    def verify_certificate(self, verification_code: str) -> dict:
        return self._request("POST", "/exams/certificates/verify", json={"verificationCode": verification_code})

    def exam_analytics(self, exam_id: str) -> dict:
        return self._request("POST", "/exams/analytics", json={"examId": exam_id})

    def exam_security(self, action: str, payload: dict) -> dict:
        return self._request("POST", "/exams/security", json={"action": action, **payload})