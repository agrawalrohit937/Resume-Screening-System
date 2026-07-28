import axios from 'axios'
import api from './api'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// Bare axios instance — no auth token — for the public verify endpoint.
// Works for a recruiter who has never logged in.
const publicApi = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
})

export async function verifyCertificate(certificateId) {
    const { data } = await publicApi.get(`/certificates/verify/${certificateId}`)
    return data
}

export async function issueCertificate({ assessmentName, score, difficulty }) {
    const { data } = await api.post('/certificates/issue', {
        certificate_type: 'assessment',
        assessment_name: assessmentName,
        score,
        difficulty,
    })
    return data
}

export async function claimCertificate({ topic, score, difficulty }) {
    const { data } = await api.post('/certificates/claim', {
        topic,
        score,
        difficulty,
    })
    return data
}

export async function getMyCertificates() {
    const { data } = await api.get('/certificates/my')
    return data
}
