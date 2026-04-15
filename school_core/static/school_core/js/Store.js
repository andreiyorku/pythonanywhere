export default class Store {
    constructor() {
        this.userId = null;
        this.isAdmin = false;

        this.courseId = null;
        this.courseName = "";
        this.courseOwner = null;

        this.chapterId = null;
        this.chapterName = "";

        this.quizDeck = [];
        this.currentQuizItem = null;
        this.lastQuizItemId = null;
        this.quizChapterIds = [];
        this.coursePercentages = {};
        this.chapterMode = 'standard';
        this.quizReturnView = 'hub';

        this.isRegisterMode = false;
        this.pendingGitSync = false;
        this.gitSyncInterval = null;

        this.pendingHeaderFile = null;
        this.pendingBodyFiles = [];
    }
}
// Export a single instance so all classes share the exact same state memory
export const state = new Store();