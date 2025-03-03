const express= require("express");
const { check } = require("express-validator");
const checkAuth=require("../middleware/check-auth");
const router = express.Router();

const {
    getCommentsByBlogId,
    insertComment,
    updateComment,
    deleteComment,
    deleteCommentByBlogId
}=require("../controllers/comments-controller")

router.get("/:bid", getCommentsByBlogId);

router.use(checkAuth);
router.post(
    "/",
    [
      check("content").not().isEmpty(),
      check("creator").notEmpty()
    ],
    insertComment
);
router.patch(
    "/:cid",
    [
        check("content").not().isEmpty()
    ],
    updateComment
    )

router.delete(
    "/all/:bid",deleteCommentByBlogId
)

router.delete(
    "/:cid",deleteComment
)

module.exports=router;