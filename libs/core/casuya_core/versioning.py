import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class Version:
    major: int
    minor: int
    patch: int
    pre: Optional[str] = None
    build: Optional[str] = None

    @classmethod
    def parse(cls, version_str: str) -> "Version":
        pattern = r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
        m = re.match(pattern, version_str.strip())
        if not m:
            raise ValueError(f"Invalid semver string: {version_str}")
        return cls(
            major=int(m.group(1)),
            minor=int(m.group(2)),
            patch=int(m.group(3)),
            pre=m.group(4),
            build=m.group(5),
        )

    def __str__(self) -> str:
        s = f"{self.major}.{self.minor}.{self.patch}"
        if self.pre:
            s += f"-{self.pre}"
        if self.build:
            s += f"+{self.build}"
        return s

    def bump_major(self) -> "Version":
        return Version(major=self.major + 1, minor=0, patch=0)

    def bump_minor(self) -> "Version":
        return Version(major=self.major, minor=self.minor + 1, patch=0)

    def bump_patch(self) -> "Version":
        return Version(major=self.major, minor=self.minor, patch=self.patch + 1)


def compare_versions(a: str, b: str) -> int:
    va = Version.parse(a)
    vb = Version.parse(b)
    for attr in ("major", "minor", "patch"):
        diff = getattr(va, attr) - getattr(vb, attr)
        if diff:
            return -1 if diff < 0 else 1
    if va.pre and not vb.pre:
        return -1
    if not va.pre and vb.pre:
        return 1
    if va.pre and vb.pre:
        return -1 if va.pre < vb.pre else 1 if va.pre > vb.pre else 0
    return 0


def is_compatible(version: str, constraint: str) -> bool:
    v = Version.parse(version)
    c = Version.parse(constraint)
    return v.major == c.major and (
        v.minor > c.minor or (v.minor == c.minor and v.patch >= c.patch)
    )
