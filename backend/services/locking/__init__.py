"""
Distributed Locking Module for Multi-Replica CareerPilot ATS Deployments.
"""

from services.locking.distributed_lock import DistributedLock, distributed_lock

__all__ = ["DistributedLock", "distributed_lock"]
