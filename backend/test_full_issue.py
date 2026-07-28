"""Full end-to-end certificate issue test."""
import asyncio
import sys
import traceback

sys.path.insert(0, '.')


async def full_test():
    from config.db import connect_db
    await connect_db()

    from certificates.service import CertificateService
    context = {
        'recipient_name': 'Rohit Agrawal',
        'assessment_name': 'Python',
        'assessment_slug': 'python',
        'difficulty': 'Intermediate',
        'score': 90,
    }
    try:
        record, pdf_bytes = await CertificateService.issue(
            user_id='test-user-id-123',
            certificate_type='assessment',
            context=context,
        )
        grade = record.snapshot.get('grade_label')
        print(f'SUCCESS!')
        print(f'  cert_id:    {record.id}')
        print(f'  public_url: {record.public_url}')
        print(f'  pdf_bytes:  {len(pdf_bytes):,}')
        print(f'  grade:      {grade}')
    except Exception as e:
        print('FULL ISSUE FAILED:')
        traceback.print_exc()


asyncio.run(full_test())
