path = 'frontend/src/components/detection/CheatingWarningModal.jsx'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace lines 42-50
old_ret = """  if (!event) return null

  const cfg = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium
  const em  = EVENT_MESSAGES[event.event_type] || { msg: event.details || 'Integrity event detected.', sub:'' }
  const isLast = warningCount >= Math.max(1, maxWarnings - 1)

  return (
    <AnimatePresence>
      <motion.div"""

new_ret = """  const cfg = event ? (SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium) : SEVERITY_CONFIG.medium
  const em  = event ? (EVENT_MESSAGES[event.event_type] || { msg: event.details || 'Integrity event detected.', sub:'' }) : { msg: '', sub: '' }
  const isLast = warningCount >= Math.max(1, maxWarnings - 1)

  return (
    <AnimatePresence>
      {event && (
        <motion.div key="warning-modal-backdrop\""""

# And at the bottom of the component, close the conditional before </AnimatePresence>
old_end = """        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}"""

new_end = """        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}"""

norm_code = code.replace('\r\n', '\n')
norm_old_ret = old_ret.replace('\r\n', '\n')
norm_new_ret = new_ret.replace('\r\n', '\n')
norm_old_end = old_end.replace('\r\n', '\n')
norm_new_end = new_end.replace('\r\n', '\n')

if norm_old_ret in norm_code and norm_old_end in norm_code:
    norm_code = norm_code.replace(norm_old_ret, norm_new_ret)
    norm_code = norm_code.replace(norm_old_end, norm_new_end)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(norm_code.replace('\n', '\r\n'))
    print("Updated CheatingWarningModal.jsx successfully!")
else:
    print("Could not match old blocks in CheatingWarningModal.jsx")

