"""
Custom exceptions for Casuya Core.
"""


class CasuyaError(Exception):
    """Base exception for all Casuya errors."""
    pass


class ValidationError(CasuyaError):
    """Raised when validation fails."""
    def __init__(self, message: str, errors: list = None):
        self.errors = errors or []
        super().__init__(message)


class CompilationError(CasuyaError):
    """Raised during compilation process."""
    pass


class PackagingError(CasuyaError):
    """Raised during packaging."""
    pass


class SignatureError(CasuyaError):
    """Raised for signature or integrity issues."""
    pass


class VersionError(CasuyaError):
    """Raised for versioning issues."""
    pass


class StorageError(CasuyaError):
    """Raised for storage-related errors."""
    pass


class CompressionError(CasuyaError):
    """Raised during compression."""
    pass


class ParserError(CasuyaError):
    """Raised during parsing."""
    pass


class OptimizationError(CasuyaError):
    """Raised during optimization."""
    pass


class MigrationError(CasuyaError):
    """Raised during migration."""
    pass


class SecurityError(CasuyaError):
    """Raised for security violations."""
    pass


class LoaderError(CasuyaError):
    """Raised during loading/extraction."""
    pass


class CacheError(CasuyaError):
    """Raised during caching."""
    pass