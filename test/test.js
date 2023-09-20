'use strict'
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

/**
 * テストで使用したデータを削除する関数
 * @param {UUID} scheduleId 
 * @returns {void}
 */
async function deleteScheduleAggregate(scheduleId) {
    await prisma.candidate.deleteMany({ where: { scheduleId } });
    await prisma.schedule.deleteMany({ where: { scheduleId } });
}

describe('/login', () => {

    beforeAll(() => {
        passportStub.install(app);
        passportStub.login({ username: 'test_user' });
    })

    test('ログイン状態の時ログアウトボタンが表示される', async () => {
        await request(app).get('/login')

            // 引数を二つ渡した場合はヘッダをテストする
            .expect('Content-Type', 'text/html; charset=utf-8')

            // 引数に正規表現を渡した場合はbodyにその文字列があるかをテストする
            .expect(/ログアウト/)

            // 引数に数値を渡した場合はステータスコードをテストする
            .expect(200)

    })

    test('ログイン時はユーザー名が表示される', async () => {
        await request(app).get('/login')
            .expect(/でログイン中/)
            .expect(200)
    })

    test('ログアウト時はリダイレクトされる', async () => {
        await request(app).get('/logout')
            .expect('Location', '/login')
            .expect(302)
    })

    afterAll(() => {
        passportStub.logout();
        passportStub.uninstall();
    })
})

// テストはまともに使えないので放棄
describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId', () => {
    let scheduleId = 'c5d72273-35d9-4094-b868-92771cf8ba2e';
    beforeAll(() => {
        passportStub.install(app);
        passportStub.login({ id: 0, username: 'test_user' });
    });

    afterAll(async () => {
        passportStub.logout();
        passportStub.uninstall();
        await deleteScheduleAggregate(scheduleId);
    });

    test('出欠が更新できる', async function () {
        const data = { userId: '0', username: 'test_user' };
        await prisma.user.upsert({
            where: { userId: data.userId },
            create: data,
            update: data
        });
        const res = await request(app)
            .post('/schedules')
            .send({ scheduleName: 'テスト出欠更新予定1', memo: 'テスト出欠更新メモ1', candidates: 'テスト出欠更新候補1' });
        const createdSchedulePath = res.headers.location;
        scheduleId = createdSchedulePath.split('/schedules/')[1];
        const candidate = await prisma.candidate.findFirst({ where: { scheduleId } });
        // 更新がされることをテスト
        await request(app)
            .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidateId}`)
            .send({ availability: 2 }) // 出席に更新
            .expect('{"status":"OK","availability":2}');
    });
})