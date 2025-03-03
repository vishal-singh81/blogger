import React from "react";
import { useNavigate } from "react-router";
import Input from "../components/FormElements/Input";
import { VALIDATOR_MINLENGTH, VALIDATOR_REQUIRE } from "../util/validators";
import Button from "../components/FormElements/Button";
import { useForm } from "../hooks/form-hook";
import "./BlogForm.css";
import ErrorModal from "../components/UIElements/ErrorModal";
import LoadingSpinner from "../components/UIElements/LoadingSpinner";
import { useContext } from "react";
import { AuthContext } from "../context/auth-context";
import { useHttpClient } from "../hooks/http-hook";
import ImageUpload from "../components/FormElements/ImageUpload";
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

const NewBlog = () => {
  const auth = useContext(AuthContext);
  // can use any name here using array destructuring
  const [formState, InputHandler] = useForm(
    {
      Title: {
        value: "",
        isValid: false,
      },
      description: {
        value: "",
        isValid: false,
      },
      content: {
        value: "",
        isValid: false,
      },
    },
    false
  );

  const navigate = useNavigate();
  const { isLoading, error, sendRequest, clearError } = useHttpClient();

  const blogSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
      const yyyy = today.getFullYear();

      const date = dd + "/" + mm + "/" + yyyy;

      const formData = new FormData();
      formData.append("title", formState.inputs.Title.value);
      formData.append("description", formState.inputs.description.value);
      formData.append("content", formState.inputs.content.value);
      formData.append("image", formState.inputs.image.value);
      formData.append("creator", auth.userId);
      formData.append("date", date);

      const msg=await sendRequest(
        process.env.process.env.REACT_APP_BACKEND_URL+"blogs",
        "POST",
        formData,{
          Authorization: "Bearer "+auth.token,
          // "Content-Type":"application/json"
        }
        
      );
      console.log(msg)
      const ret=await sendRequest(
        process.env.REACT_APP_BACKEND_URL+"/comments",
        "POST",
        JSON.stringify({
            content:"abcdef",
            creator:auth.userId,
            blogId:msg.blog._id,
            parentId:""
        }),
        {
          Authorization: "Bearer "+auth.token,
          "Content-Type":"application/json"
        }
      );

      // redirect the user to a different page
      // allow the user to go the starting page after login
      // you can also use navigate to go to the past and present page in the history
      navigate("/");
    } catch (err) {}
  };
  return (
    <>
      <ErrorModal error={error} onClear={clearError} />
      <form className="blog-form" onSubmit={blogSubmitHandler}>
        {/* we should pass whether input is valid from child input to here to check the overall validity of the form*/}
        {isLoading && <LoadingSpinner asOverlay />}
        <Input
          element="input"
          type="text"
          id="Title"
          label="Title"
          validators={[VALIDATOR_REQUIRE()]}
          errorText="Please enter a valid title"
          onInput={InputHandler}
        />
        <ImageUpload center id="image" onInput={InputHandler} errorText="Please provide an image"/>
        <Input
          element="textarea"
          id="description"
          label="description"
          rows={3}
          validators={[VALIDATOR_MINLENGTH(5)]}
          errorText="Please enter a valid description(atleast 5 characters)"
          onInput={InputHandler}
        />
        {/* <Input
          element="textarea"
          id="content"
          label="content"
          rows={10}
          validators={[VALIDATOR_MINLENGTH(20)]}
          errorText="Please enter a valid content(atleast 20 characters)"
          onInput={InputHandler}
        /> */}
        <div className="ckeditor">
          <label htmlFor={"Content"}>{"Content"}</label>
          <CKEditor
              editor={ ClassicEditor }
              // data={loadedBlog.content}
              // onReady={ editor => {
              //     // You can store the "editor" and use when it is needed.
              //     console.log( 'Editor is ready to use!', editor );
              // } }
              onChange={ ( event, editor ) => {
                  const data = editor.getData();
                  InputHandler("content",data,true)
              } }
          />
        </div>
        <Button type="submit" disabled={!formState.isValid}>
          ADD BLOG
        </Button>
      </form>
    </>
  );
};

export default NewBlog;
