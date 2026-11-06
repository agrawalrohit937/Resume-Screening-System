/**
 * Dynamically loads the Razorpay Checkout SDK script on-demand.
 * Ensures initial page loads (Landing, Login, Dashboard) are fast and not blocked by payment SDKs.
 */
export function loadRazorpaySDK() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true)
    }
    const scriptId = 'razorpay-checkout-sdk'
    let script = document.getElementById(scriptId)
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve(true)
      script.onerror = () => {
        console.error('[Razorpay] Failed to load checkout SDK script.')
        resolve(false)
      }
      document.body.appendChild(script)
    } else {
      script.onload = () => resolve(true)
    }
    setTimeout(() => resolve(Boolean(window.Razorpay)), 5000)
  })
}

