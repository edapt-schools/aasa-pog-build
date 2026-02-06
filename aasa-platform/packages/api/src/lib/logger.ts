/**
 * Server-side logging utility
 * Development: Console with timestamps
 * Production: Structured JSON logs (ready for Sentry/Datadog)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Development: Human-readable with colors
      const levelColors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m', // Green
        warn: '\x1b[33m', // Yellow
        error: '\x1b[31m', // Red
      }
      const reset = '\x1b[0m'
      const color = levelColors[entry.level]

      let output = `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}${reset}: ${entry.message}`

      if (entry.context) {
        output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.name}: ${entry.error.message}`
        if (entry.error.stack) {
          output += `\n${entry.error.stack}`
        }
      }

      return output
    } else {
      // Production: Structured JSON for log aggregation
      return JSON.stringify(entry)
    }
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    }

    if (context) {
      entry.context = context
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    return entry
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>) {
    const entry = this.createLogEntry('debug', message, context)
    console.debug(this.formatLogEntry(entry))
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>) {
    const entry = this.createLogEntry('info', message, context)
    console.info(this.formatLogEntry(entry))
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>) {
    const entry = this.createLogEntry('warn', message, context)
    console.warn(this.formatLogEntry(entry))
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>) {
    const entry = this.createLogEntry('error', message, context, error)
    console.error(this.formatLogEntry(entry))

    // TODO: Send to error tracking service (Sentry, Datadog, etc.)
    // this.sendToErrorTracking(entry)
  }

  /**
   * Log HTTP request
   */
  request(method: string, path: string, context?: Record<string, unknown>) {
    this.info(`${method} ${path}`, context)
  }

  /**
   * Log HTTP response
   */
  response(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: Record<string, unknown>
  ) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    this.createLogEntry(
      level,
      `${method} ${path} - ${statusCode} (${duration}ms)`,
      context
    )
  }
}

// Export singleton instance
export const logger = new Logger()

/**
 * Express middleware for request logging
 */
export function requestLogger(req: any, res: any, next: any) {
  const startTime = Date.now()

  // Log request
  logger.request(req.method, req.path, {
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime
    logger.response(req.method, req.path, res.statusCode, duration, {
      userId: req.userId,
    })
  })

  next()
}
