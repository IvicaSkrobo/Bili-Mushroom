use std::sync::{Arc, OnceLock};

use tokio::sync::Semaphore;

static THUMBNAIL_WORKERS: OnceLock<Arc<Semaphore>> = OnceLock::new();

fn worker_count_for(logical_cpus: usize) -> usize {
    // Decoding a modern phone photo can briefly require hundreds of MB. Half the
    // logical CPUs keeps weaker machines responsive, while the small upper bound
    // prevents high-core systems from decoding a wall of originals at once.
    (logical_cpus.saturating_add(1) / 2).clamp(2, 3)
}

fn thumbnail_workers() -> Arc<Semaphore> {
    THUMBNAIL_WORKERS
        .get_or_init(|| {
            let logical_cpus = std::thread::available_parallelism()
                .map(|count| count.get())
                .unwrap_or(2);
            Arc::new(Semaphore::new(worker_count_for(logical_cpus)))
        })
        .clone()
}

/// Runs one memory-heavy thumbnail decode without letting a large virtualized list
/// flood Tokio's blocking pool. The semaphore is acquired before spawning the worker,
/// so queued requests do not consume OS threads while they wait.
pub async fn run_thumbnail_job<T, F>(job: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    let permit = thumbnail_workers()
        .acquire_owned()
        .await
        .map_err(|_| "Thumbnail worker queue was closed".to_string())?;
    let result = tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|error| format!("Thumbnail worker failed: {error}"))?;
    drop(permit);
    result
}

#[cfg(test)]
mod tests {
    use super::worker_count_for;

    #[test]
    fn thumbnail_worker_count_is_adaptive_but_memory_bounded() {
        assert_eq!(worker_count_for(1), 2);
        assert_eq!(worker_count_for(2), 2);
        assert_eq!(worker_count_for(4), 2);
        assert_eq!(worker_count_for(8), 3);
        assert_eq!(worker_count_for(64), 3);
    }
}
